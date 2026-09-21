"""Model factory + architecture selection guidance.

Default is **efficientnet_b0**: the best accuracy / latency / size trade-off for a
CPU-servable catalogue classifier (~5.3M params, ~20 MB fp32, ~25 ms/image on a
modern CPU core, strong ImageNet transfer). Swap ``model.name`` in
``config/training.yaml`` to any entry below (or any timm model id).
"""

from __future__ import annotations

from dataclasses import dataclass

from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)

@dataclass(frozen=True)
class ModelSpec:
    name: str
    params_m: float
    default_size: int
    notes: str

#: Curated shortlist evaluated for this task.
MODEL_ZOO: dict[str, ModelSpec] = {
    "mobilenetv3_large_100": ModelSpec(
        "mobilenetv3_large_100", 5.5, 224,
        "Fastest on CPU; use when latency matters more than the last 1-2% accuracy.",
    ),
    "efficientnet_b0": ModelSpec(
        "efficientnet_b0", 5.3, 224,
        "DEFAULT. Best overall balance of accuracy, size and CPU inference speed.",
    ),
    "efficientnet_b2": ModelSpec(
        "efficientnet_b2", 9.1, 260,
        "Higher accuracy, ~2x the compute of b0. Good when a GPU is available.",
    ),
    "resnet50": ModelSpec(
        "resnet50", 25.6, 224,
        "Very robust baseline, largest of the shortlist; easiest to export/serve.",
    ),
    "convnext_tiny": ModelSpec(
        "convnext_tiny", 28.6, 224,
        "Strongest accuracy on fine-grained texture classes (tiles vs finishes), "
        "but heavier and slower on CPU.",
    ),
    "efficientnetv2_rw_s": ModelSpec(
        "efficientnetv2_rw_s", 23.9, 288,
        "Excellent accuracy with fast GPU training; larger export.",
    ),
}

def build_model(name: str, num_classes: int, *, pretrained: bool = True,
    drop_rate: float = 0.2, drop_path_rate: float = 0.1):
    """Create a timm backbone with a fresh classification head."""
    import timm

    if name in MODEL_ZOO:
        logger.info("Model %s: %s", name, MODEL_ZOO[name].notes)
    kwargs = {"pretrained": pretrained, "num_classes": num_classes, "drop_rate": drop_rate}
    try:
        model = timm.create_model(name, drop_path_rate=drop_path_rate, **kwargs)
    except TypeError: # architectures without stochastic depth
        model = timm.create_model(name, **kwargs)
    return model

def split_parameters(model):
    """Return (backbone_params, head_params) for discriminative learning rates."""
    head_names = set()
    try:
        classifier = model.get_classifier()
        head_names = {id(p) for p in classifier.parameters()}
    except Exception: # pragma: no cover
        pass

    backbone, head = [], []
    for param in model.parameters():
        (head if id(param) in head_names else backbone).append(param)
    return backbone, head

def set_backbone_trainable(model, trainable: bool) -> None:
    _, head = split_parameters(model)
    head_ids = {id(p) for p in head}
    for param in model.parameters():
        if id(param) not in head_ids:
            param.requires_grad = trainable

def count_parameters(model) -> int:
    return sum(p.numel() for p in model.parameters())
