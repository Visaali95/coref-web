"""YAML-backed training configuration.

Everything tunable lives in ``config/training.yaml`` - the core code never needs
to be edited to change a hyper-parameter.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, fields, is_dataclass
from pathlib import Path
from typing import Any

import yaml

from furniture_ml.config import PROJECT_ROOT

DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config" / "training.yaml"

@dataclass
class ModelConfig:
    name: str = "efficientnet_b0"
    pretrained: bool = True
    drop_rate: float = 0.2
    drop_path_rate: float = 0.1
    freeze_backbone_epochs: int = 2 # linear-probe warmup, then full fine-tune

@dataclass
class DataConfig:
    dataset_dir: str | None = None # defaults to settings.dataset_dir
    image_size: int = 224
    batch_size: int = 32
    num_workers: int = 4
    val_split: float = 0.15
    test_split: float = 0.15
    seed: int = 42
    min_images_per_class: int = 5
    exclude_dirs: list[str] = field(default_factory=lambda: ["_unlabelled", "_rejected"])

@dataclass
class AugmentationConfig:
    horizontal_flip: float = 0.5
    vertical_flip: float = 0.0
    rotation_degrees: float = 12.0
    random_resized_crop_scale: tuple[float, float] = (0.7, 1.0)
    color_jitter: float = 0.25
    grayscale_prob: float = 0.05
    gaussian_blur_prob: float = 0.10
    random_erasing: float = 0.15
    mixup_alpha: float = 0.0

@dataclass
class OptimConfig:
    epochs: int = 30
    optimizer: str = "adamw" # adamw | sgd
    lr: float = 3e-4
    head_lr_multiplier: float = 10.0
    weight_decay: float = 1e-4
    momentum: float = 0.9
    scheduler: str = "cosine" # cosine | step | none
    warmup_epochs: int = 1
    label_smoothing: float = 0.05
    grad_clip: float = 1.0
    amp: bool = True

@dataclass
class BalancingConfig:
    strategy: str = "auto" # auto | class_weights | sampler | none
    imbalance_trigger_ratio: float = 2.0

@dataclass
class EarlyStoppingConfig:
    enabled: bool = True
    monitor: str = "val_f1_macro" # val_f1_macro | val_accuracy | val_loss
    mode: str = "max"
    patience: int = 7
    min_delta: float = 1e-4

@dataclass
class OutputConfig:
    models_dir: str | None = None
    artifacts_dir: str | None = None
    checkpoint_name: str = "best.ckpt"
    export_name: str = "classifier.pt"
    labels_name: str = "labels.json"
    export_torchscript: bool = True
    export_onnx: bool = False

@dataclass
class TrainingConfig:
    model: ModelConfig = field(default_factory=ModelConfig)
    data: DataConfig = field(default_factory=DataConfig)
    augmentation: AugmentationConfig = field(default_factory=AugmentationConfig)
    optim: OptimConfig = field(default_factory=OptimConfig)
    balancing: BalancingConfig = field(default_factory=BalancingConfig)
    early_stopping: EarlyStoppingConfig = field(default_factory=EarlyStoppingConfig)
    output: OutputConfig = field(default_factory=OutputConfig)

    def to_dict(self) -> dict:
        return asdict(self)

    def save(self, path: Path) -> Path:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(yaml.safe_dump(self.to_dict(), sort_keys=False), encoding="utf-8")
        return path

def _merge(instance: Any, data: dict) -> Any:
    """Recursively overlay a dict onto a dataclass instance."""
    if not data:
        return instance
    known = {f.name: f for f in fields(instance)}
    for key, value in data.items():
        if key not in known:
            raise ValueError(f"Unknown config key: '{key}' in {type(instance).__name__}")
        current = getattr(instance, key)
        if is_dataclass(current) and isinstance(value, dict):
            setattr(instance, key, _merge(current, value))
        elif isinstance(current, tuple) and isinstance(value, list):
            setattr(instance, key, tuple(value))
        else:
            setattr(instance, key, value)
    return instance

def load_training_config(path: str | Path | None = None,
    overrides: dict | None = None) -> TrainingConfig:
    config = TrainingConfig()
    config_path = Path(path) if path else DEFAULT_CONFIG_PATH
    if config_path.exists():
        raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
        config = _merge(config, raw)
    if overrides:
        config = _merge(config, overrides)
    return config
