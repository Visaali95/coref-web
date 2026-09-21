"""Model loading and image classification.

Loads either the TorchScript export (preferred - no timm dependency) or a
state-dict checkpoint (falls back to rebuilding the timm backbone). Thread-safe
and cached, so the API loads the weights exactly once per process.
"""

from __future__ import annotations

import io
import json
import threading
import time
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image

from furniture_ml.config import Settings, get_settings
from furniture_ml.constants import (
    STATUS_CLASSIFIED,
    STATUS_NEEDS_REVIEW,
    UNKNOWN_LABEL,
)
from furniture_ml.exceptions import ModelNotFoundError, ValidationError
from furniture_ml.inference.schemas import PredictionResult
from furniture_ml.utils.device import resolve_device
from furniture_ml.utils.io_utils import new_image_id, read_json
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)

ImageInput = str | Path | bytes | Image.Image

_DEFAULT_MEAN = (0.485, 0.456, 0.406)
_DEFAULT_STD = (0.229, 0.224, 0.225)


class Predictor:
    def __init__(
        self,
        model_path: str | Path | None = None,
        labels_path: str | Path | None = None,
        *,
        device: str | None = None,
        confidence_threshold: float | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.model_path = Path(model_path or self.settings.model_path)
        self.labels_path = Path(labels_path or self.settings.labels_path)
        self.device = resolve_device(device)
        self.confidence_threshold = (
            self.settings.confidence_threshold
            if confidence_threshold is None
            else float(confidence_threshold)
        )
        self._lock = threading.Lock()
        self.classes: list[str] = []
        self.image_size: int = self.settings.image_size
        self.model_name: str = "unknown"
        self._model = None
        self._transform = None
        self._load()

    # ------------------------------------------------------------------ load
    def _load(self) -> None:
        import torch

        if not self.model_path.exists():
            raise ModelNotFoundError(
                f"Trained model not found at {self.model_path}. Train one with "
                "'python scripts/train.py' or set FML_MODEL_PATH.",
                detail={"model_path": str(self.model_path)},
            )

        metadata: dict = {}
        model = None
        try:
            extra_files = {"metadata.json": ""}
            model = torch.jit.load(
                str(self.model_path), map_location=self.device, _extra_files=extra_files
            )
            raw = extra_files.get("metadata.json") or "{}"
            metadata = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
            logger.info("Loaded TorchScript model from %s", self.model_path)
        except Exception:
            checkpoint = torch.load(self.model_path, map_location=self.device, weights_only=False)
            metadata = {k: v for k, v in checkpoint.items() if k != "model_state"}
            from furniture_ml.training.model_factory import build_model  # optional dep

            model = build_model(
                checkpoint["model_name"],
                num_classes=len(checkpoint["classes"]),
                pretrained=False,
                drop_rate=0.0,
                drop_path_rate=0.0,
            )
            model.load_state_dict(checkpoint["model_state"])
            logger.info(
                "Loaded state-dict model (%s) from %s",
                checkpoint.get("model_name"), self.model_path,
            )

        # Labels file wins over embedded metadata (it is the exported source of truth).
        if self.labels_path.exists():
            label_data = read_json(self.labels_path)
            self.classes = list(label_data["classes"])
            self.image_size = int(label_data.get("image_size", self.image_size))
            self.model_name = label_data.get("model_name", metadata.get("model_name", "unknown"))
        else:
            self.classes = list(metadata.get("classes", []))
            self.image_size = int(metadata.get("image_size", self.image_size))
            self.model_name = metadata.get("model_name", "unknown")

        if not self.classes:
            raise ModelNotFoundError(
                "Model loaded but the class list is missing. Re-export the model or "
                f"provide {self.labels_path}."
            )

        self._model = model.eval().to(self.device)
        self._transform = self._build_transform(metadata.get("preprocessing"))
        logger.info(
            "Predictor ready | model=%s | classes=%s | size=%s | device=%s | threshold=%.2f",
            self.model_name, len(self.classes), self.image_size,
            self.device, self.confidence_threshold,
        )

    def _build_transform(self, preprocessing: dict | None):
        from torchvision import transforms as T

        preprocessing = preprocessing or {}
        size = int(preprocessing.get("center_crop", self.image_size))
        resize = int(preprocessing.get("resize", round(size * 1.14)))
        mean = tuple(preprocessing.get("mean", _DEFAULT_MEAN))
        std = tuple(preprocessing.get("std", _DEFAULT_STD))
        return T.Compose(
            [T.Resize(resize), T.CenterCrop(size), T.ToTensor(), T.Normalize(mean, std)]
        )

    # ------------------------------------------------------------------- API
    @property
    def info(self) -> dict:
        return {
            "model_name": self.model_name,
            "model_path": str(self.model_path),
            "classes": self.classes,
            "num_classes": len(self.classes),
            "image_size": self.image_size,
            "device": self.device,
            "confidence_threshold": self.confidence_threshold,
        }

    def predict(
        self,
        image: ImageInput,
        *,
        image_id: str | None = None,
        page_number: int | None = None,
        threshold: float | None = None,
        source_pdf: str | None = None,
    ) -> PredictionResult:
        results = self.predict_batch(
            [image],
            image_ids=[image_id] if image_id else None,
            page_numbers=[page_number] if page_number is not None else None,
            threshold=threshold,
            source_pdfs=[source_pdf] if source_pdf else None,
        )
        return results[0]

    def predict_batch(
        self,
        images: Sequence[ImageInput],
        *,
        image_ids: Sequence[str] | None = None,
        page_numbers: Sequence[int | None] | None = None,
        source_pdfs: Sequence[str | None] | None = None,
        threshold: float | None = None,
        batch_size: int | None = None,
    ) -> list[PredictionResult]:
        import torch

        if not images:
            return []
        if image_ids is not None and len(image_ids) != len(images):
            raise ValidationError("image_ids length must match the number of images")

        threshold = self.confidence_threshold if threshold is None else float(threshold)
        batch_size = batch_size or self.settings.batch_size

        ids = list(image_ids) if image_ids else [new_image_id() for _ in images]
        pages = list(page_numbers) if page_numbers else [None] * len(images)
        pdfs = list(source_pdfs) if source_pdfs else [None] * len(images)

        results: list[PredictionResult | None] = [None] * len(images)
        pending: list[tuple[int, "torch.Tensor", str | None]] = []

        for index, item in enumerate(images):
            try:
                tensor, path = self._to_tensor(item)
                pending.append((index, tensor, path))
            except Exception as exc:
                logger.warning("Could not decode image %s: %s", ids[index], exc)
                results[index] = PredictionResult.failed(ids[index], str(exc), pages[index])

        for start in range(0, len(pending), batch_size):
            chunk = pending[start : start + batch_size]
            batch = torch.stack([t for _, t, _ in chunk]).to(self.device)
            started = time.perf_counter()
            with self._lock, torch.no_grad():
                logits = self._model(batch)
                probs = torch.softmax(logits.float(), dim=1).cpu().numpy()
            elapsed_ms = (time.perf_counter() - started) * 1000 / len(chunk)

            for row, (index, _, path) in enumerate(chunk):
                distribution = probs[row]
                best = int(distribution.argmax())
                confidence = float(distribution[best])
                raw_category = self.classes[best]
                below = confidence < threshold
                results[index] = PredictionResult(
                    image_id=ids[index],
                    category=UNKNOWN_LABEL if below else raw_category,
                    confidence=confidence,
                    page_number=pages[index],
                    status=STATUS_NEEDS_REVIEW if below else STATUS_CLASSIFIED,
                    source_pdf=pdfs[index],
                    image_path=path,
                    raw_category=raw_category,
                    probabilities={
                        self.classes[i]: float(distribution[i]) for i in range(len(self.classes))
                    },
                    inference_ms=elapsed_ms,
                )

        return [r for r in results if r is not None]

    def predict_paths(self, paths: Iterable[str | Path], **kwargs) -> list[PredictionResult]:
        paths = [Path(p) for p in paths]
        return self.predict_batch(paths, image_ids=kwargs.pop("image_ids", None), **kwargs)

    # ------------------------------------------------------------- internals
    def _to_tensor(self, item: ImageInput):
        path: str | None = None
        if isinstance(item, Image.Image):
            image = item.convert("RGB")
        elif isinstance(item, (bytes, bytearray)):
            with Image.open(io.BytesIO(bytes(item))) as opened:
                opened.load()
                image = opened.convert("RGB")
        else:
            path = str(item)
            file_path = Path(item)
            if not file_path.exists():
                raise ValidationError(f"Image file not found: {file_path}")
            with Image.open(file_path) as opened:
                opened.load()
                image = opened.convert("RGB")
        return self._transform(image), path


# --------------------------------------------------------------------------
_predictor: Predictor | None = None
_predictor_lock = threading.Lock()


def get_predictor(force_reload: bool = False, **kwargs) -> Predictor:
    """Process-wide cached predictor (used by the API)."""
    global _predictor
    with _predictor_lock:
        if _predictor is None or force_reload:
            _predictor = Predictor(**kwargs)
        return _predictor


def reset_predictor() -> None:
    global _predictor
    with _predictor_lock:
        _predictor = None
