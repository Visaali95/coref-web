"""Local embedding extractor reusing the classifier backbone.

Priority:
1. Fine-tuned backbone from ``models/best.ckpt`` (state-dict) via ``timm``.
2. ImageNet-pretrained ``timm`` backbone (works before any training).
3. Colour-histogram fallback (no ``timm`` installed, e.g. slim image).

All outputs are L2-normalised so cosine == dot product.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from furniture_ml.config import Settings, get_settings
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)

_MEAN = (0.485, 0.456, 0.406)
_STD = (0.229, 0.224, 0.225)


class BackboneEmbedder:
    def __init__(
        self,
        model_name: str = "efficientnet_b0",
        image_size: int = 224,
        device: str = "cpu",
        settings: Settings | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.model_name = model_name
        self.image_size = image_size
        self.device = device
        self._model = None
        self._transform = None
        self.backend = "histogram"
        self._init_backend()

    # ------------------------------------------------------------ backend
    def _init_backend(self) -> None:
        try:
            import timm  # noqa: F401
            import torch

            self._init_timm(torch)
            self.backend = "timm"
        except Exception as exc:  # pragma: no cover - env dependent
            logger.warning("timm backbone unavailable (%s); using histogram fallback", exc)
            self.backend = "histogram"

    def _init_timm(self, torch) -> None:
        import timm
        from torchvision import transforms as T

        size = self.image_size
        resize = round(size * 1.14)
        self._transform = T.Compose(
            [
                T.Resize(resize),
                T.CenterCrop(size),
                T.ToTensor(),
                T.Normalize(_MEAN, _STD),
            ]
        )
        # Feature-only model (no classifier head).
        try:
            model = timm.create_model(
                self.model_name, pretrained=True, num_classes=0, global_pool="avg"
            )
        except TypeError:
            model = timm.create_model(self.model_name, pretrained=True, num_classes=0)
        # Try to load fine-tuned backbone weights when a checkpoint exists.
        ckpt = self.settings.models_dir / "best.ckpt"
        if ckpt.exists():
            try:
                payload = torch.load(str(ckpt), map_location="cpu", weights_only=False)
                state = payload.get("model_state", payload)
                missing, unexpected = model.load_state_dict(state, strict=False)
                logger.info(
                    "Loaded fine-tuned backbone from %s (missing=%d unexpected=%d)",
                    ckpt, len(missing), len(unexpected),
                )
                # Detect trained image size / model name from checkpoint.
                self.model_name = payload.get("model_name", self.model_name)
            except Exception as exc:
                logger.warning("Could not load fine-tuned weights: %s", exc)
        self._model = model.eval().to(self.device)
        self.dim = int(getattr(model, "num_features", 1280))

    # ------------------------------------------------------------- embed
    @property
    def embedding_dim(self) -> int:
        if self.backend == "timm":
            return int(getattr(self._model, "num_features", 1280))
        return 512  # 8x8x8 histogram

    def _histogram(self, image: Image.Image) -> np.ndarray:
        small = image.convert("RGB").resize((64, 64), Image.BICUBIC)
        arr = np.asarray(small, dtype=np.float32) / 255.0
        hist, _ = np.histogramdd(
            arr.reshape(-1, 3),
            bins=(8, 8, 8),
            range=((0, 1), (0, 1), (0, 1)),
        )
        vec = hist.ravel().astype(np.float32)
        norm = float(np.linalg.norm(vec))
        return vec / norm if norm > 0 else vec

    def embed_image(self, image: str | Path | Image.Image) -> np.ndarray:
        if isinstance(image, Image.Image):
            pil = image.convert("RGB")
        else:
            with Image.open(image) as opened:
                opened.load()
                pil = opened.convert("RGB")
        if self.backend == "histogram" or self._model is None:
            return self._histogram(pil)
        import torch

        with torch.no_grad():
            tensor = self._transform(pil).unsqueeze(0).to(self.device)
            feats = self._model(tensor).float().cpu().numpy()[0]
        norm = float(np.linalg.norm(feats))
        return (feats / norm).astype(np.float32) if norm > 0 else feats.astype(np.float32)

    def embed_many(
        self, images: list[str | Path | Image.Image], batch_size: int = 16
    ) -> np.ndarray:
        if self.backend == "histogram" or self._model is None:
            return np.stack([self.embed_image(i) for i in images]).astype(np.float32)
        import torch

        vectors: list[np.ndarray] = []
        for start in range(0, len(images), batch_size):
            chunk = images[start : start + batch_size]
            tensors = []
            for item in chunk:
                if isinstance(item, Image.Image):
                    pil = item.convert("RGB")
                else:
                    with Image.open(item) as opened:
                        opened.load()
                        pil = opened.convert("RGB")
                tensors.append(self._transform(pil))
            batch = torch.stack(tensors).to(self.device)
            with torch.no_grad():
                feats = self._model(batch).float().cpu().numpy()
            norms = np.linalg.norm(feats, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            vectors.append((feats / norms).astype(np.float32))
        return np.concatenate(vectors, axis=0) if vectors else np.zeros((0, self.dim))
