"""Model export: TorchScript (default), state-dict checkpoint and optional ONNX,
plus the class-label mapping consumed by the inference module."""

from __future__ import annotations

import json
from pathlib import Path

from furniture_ml.utils.io_utils import ensure_dir, write_json
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)

def write_label_map(classes: list[str], path: Path, *, model_name: str,
    image_size: int) -> Path:
    """Persist the index -> category mapping. This file is the inference-time
    source of truth for the taxonomy."""
    payload = {
        "classes": list(classes),
        "class_to_idx": {c: i for i, c in enumerate(classes)},
        "idx_to_class": {str(i): c for i, c in enumerate(classes)},
        "model_name": model_name,
        "image_size": image_size,
        "num_classes": len(classes),
    }
    write_json(path, payload)
    logger.info("Label map written to %s", path)
    return path

def export_model(model, *, classes: list[str], config, models_dir: Path, device: str) -> Path:
    """Export a self-contained artefact that inference can load without timm."""
    import torch

    ensure_dir(models_dir)
    export_path = models_dir / config.output.export_name
    image_size = config.data.image_size

    model = model.eval()
    metadata = {
        "classes": classes,
        "model_name": config.model.name,
        "image_size": image_size,
        "num_classes": len(classes),
        "preprocessing": {
            "resize": int(round(image_size * 1.14)),
            "center_crop": image_size,
            "mean": [0.485, 0.456, 0.406],
            "std": [0.229, 0.224, 0.225],
        },
    }

    if config.output.export_torchscript:
        try:
            cpu_model = model.to("cpu").eval()
            example = torch.randn(1, 3, image_size, image_size)
            with torch.no_grad():
                scripted = torch.jit.trace(cpu_model, example, strict=False)
                scripted = torch.jit.freeze(scripted)
            extra = {"metadata.json": json.dumps(metadata).encode("utf-8")}
            scripted.save(str(export_path), _extra_files=extra)
            model.to(device)
            logger.info("TorchScript model exported to %s", export_path)
        except Exception as exc: # pragma: no cover - architecture dependent
            logger.warning("TorchScript export failed (%s); falling back to state_dict", exc)
            _export_state_dict(model, export_path, metadata)
    else:
        _export_state_dict(model, export_path, metadata)

    if config.output.export_onnx:
        _export_onnx(model, models_dir / (export_path.stem + ".onnx"), image_size)

    write_json(models_dir / "model_metadata.json", metadata)
    return export_path

def _export_state_dict(model, path: Path, metadata: dict) -> None:
    import torch

    torch.save({"model_state": model.state_dict(), **metadata, "format": "state_dict"}, path)
    logger.info("State-dict model exported to %s", path)

def _export_onnx(model, path: Path, image_size: int) -> None:
    import torch

    try:
        dummy = torch.randn(1, 3, image_size, image_size)
        torch.onnx.export(
            model.to("cpu").eval(),
            dummy,
            str(path),
            input_names=["input"],
            output_names=["logits"],
            dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
            opset_version=17,
        )
        logger.info("ONNX model exported to %s", path)
    except Exception as exc: # pragma: no cover
        logger.warning("ONNX export failed: %s", exc)
