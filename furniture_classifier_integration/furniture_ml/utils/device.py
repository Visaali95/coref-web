"""Device selection: GPU when available, CPU otherwise."""

from __future__ import annotations

from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)


def resolve_device(preference: str | None = None) -> str:
    """Resolve ``auto`` / explicit device strings to a usable torch device."""
    import torch

    from furniture_ml.config import get_settings

    pref = (preference or get_settings().device or "auto").lower()

    if pref != "auto":
        if pref.startswith("cuda") and not torch.cuda.is_available():
            logger.warning("CUDA requested but unavailable - falling back to CPU")
            return "cpu"
        if pref == "mps" and not getattr(torch.backends, "mps", None):
            logger.warning("MPS requested but unavailable - falling back to CPU")
            return "cpu"
        return pref

    if torch.cuda.is_available():
        return "cuda"
    mps = getattr(torch.backends, "mps", None)
    if mps is not None and mps.is_available():
        return "mps"
    return "cpu"


def device_info() -> dict:
    import torch

    dev = resolve_device()
    info = {"device": dev, "torch_version": torch.__version__, "cuda_available": torch.cuda.is_available()}
    if dev.startswith("cuda"):
        idx = 0 if ":" not in dev else int(dev.split(":")[1])
        info["gpu_name"] = torch.cuda.get_device_name(idx)
    return info
