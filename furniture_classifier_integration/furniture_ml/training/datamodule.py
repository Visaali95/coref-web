"""Dataset loading + stratified train/val/test splitting.

The split is computed once, deterministically (seeded), and written to
``artifacts/splits.json`` so results are reproducible and auditable.
"""

from __future__ import annotations

import random
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image
from torch.utils.data import Dataset

from furniture_ml.config import get_settings
from furniture_ml.constants import CATEGORY_SLUGS, slug_map
from furniture_ml.exceptions import DatasetError
from furniture_ml.training.config import TrainingConfig
from furniture_ml.training.transforms import build_eval_transform, build_train_transform
from furniture_ml.utils.io_utils import iter_images, write_json
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)

@dataclass
class SplitStats:
    classes: list[str]
    train: dict[str, int] = field(default_factory=dict)
    val: dict[str, int] = field(default_factory=dict)
    test: dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "classes": self.classes,
            "train": self.train,
            "val": self.val,
            "test": self.test,
            "totals": {
                "train": sum(self.train.values()),
                "val": sum(self.val.values()),
                "test": sum(self.test.values()),
            },
        }

class ImageListDataset(Dataset):
    def __init__(self, samples: list[tuple[Path, int]], transform):
        self.samples = samples
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index: int):
        path, target = self.samples[index]
        with Image.open(path) as img:
            image = img.convert("RGB")
        return self.transform(image), target

    def targets(self) -> list[int]:
        return [t for _, t in self.samples]

class DataModule:
    """Discovers, validates and splits the labelled dataset."""

    def __init__(self, config: TrainingConfig):
        self.config = config
        settings = get_settings()
        self.root = Path(config.data.dataset_dir or settings.dataset_dir)
        self.classes: list[str] = []
        self.class_to_idx: dict[str, int] = {}
        self.splits: dict[str, list[tuple[Path, int]]] = {}
        self.stats: SplitStats | None = None

    # ------------------------------------------------------------------ API
    def setup(self) -> SplitStats:
        samples_by_class = self._discover()
        self.classes = sorted(samples_by_class)
        self.class_to_idx = {c: i for i, c in enumerate(self.classes)}

        cfg = self.config.data
        rng = random.Random(cfg.seed)
        train, val, test = [], [], []

        for category in self.classes:
            paths = sorted(samples_by_class[category])
            rng.shuffle(paths)
            n = len(paths)
            n_test = max(1, int(round(n * cfg.test_split))) if cfg.test_split > 0 and n >= 5 else 0
            n_val = max(1, int(round(n * cfg.val_split))) if cfg.val_split > 0 and n >= 3 else 0
            if n - n_val - n_test < 1: # never starve the training split
                n_test = min(n_test, max(0, n - 2))
                n_val = min(n_val, max(0, n - n_test - 1))

            idx = self.class_to_idx[category]
            test += [(p, idx) for p in paths[:n_test]]
            val += [(p, idx) for p in paths[n_test : n_test + n_val]]
            train += [(p, idx) for p in paths[n_test + n_val :]]

        rng.shuffle(train)
        self.splits = {"train": train, "val": val or test, "test": test or val}

        self.stats = SplitStats(
            classes=self.classes,
            train=self._count(self.splits["train"]),
            val=self._count(self.splits["val"]),
            test=self._count(self.splits["test"]),
        )
        write_json(get_settings().artifacts_dir / "splits.json", {
            **self.stats.to_dict(),
            "files": {
                split: [str(p) for p, _ in items] for split, items in self.splits.items()
            },
        })
        logger.info("Split: %s", self.stats.to_dict()["totals"])
        return self.stats

    def dataloaders(self):
        from torch.utils.data import DataLoader, WeightedRandomSampler

        cfg = self.config
        train_tf = build_train_transform(cfg.data.image_size, cfg.augmentation)
        eval_tf = build_eval_transform(cfg.data.image_size)

        train_ds = ImageListDataset(self.splits["train"], train_tf)
        val_ds = ImageListDataset(self.splits["val"], eval_tf)
        test_ds = ImageListDataset(self.splits["test"], eval_tf)

        sampler = None
        shuffle = True
        if self._use_sampler():
            counts = Counter(train_ds.targets())
            weights = [1.0 / counts[t] for t in train_ds.targets()]
            sampler = WeightedRandomSampler(weights, num_samples=len(weights), replacement=True)
            shuffle = False
            logger.info("Using WeightedRandomSampler for class balancing")

        common = {
            "batch_size": cfg.data.batch_size,
            "num_workers": cfg.data.num_workers,
            "pin_memory": True,
        }
        return (
            DataLoader(train_ds, shuffle=shuffle, sampler=sampler, drop_last=False, **common),
            DataLoader(val_ds, shuffle=False, **common),
            DataLoader(test_ds, shuffle=False, **common),
        )

    def class_weights(self):
        import torch

        if self.config.balancing.strategy == "sampler" or self._use_sampler():
            return None
        counts = Counter(t for _, t in self.splits["train"])
        if not counts:
            return None
        ratio = max(counts.values()) / max(min(counts.values()), 1)
        if self.config.balancing.strategy == "none":
            return None
        if (
            self.config.balancing.strategy == "auto"
            and ratio < self.config.balancing.imbalance_trigger_ratio
        ):
            return None
        total = sum(counts.values())
        weights = [total / (len(self.classes) * max(counts.get(i, 0), 1)) for i in range(len(self.classes))]
        logger.info("Using class weights (imbalance ratio %.2f): %s", ratio,
            [round(w, 3) for w in weights])
        return torch.tensor(weights, dtype=torch.float32)

    # ------------------------------------------------------------- internals
    def _use_sampler(self) -> bool:
        strategy = self.config.balancing.strategy
        if strategy == "sampler":
            return True
        if strategy != "auto":
            return False
        counts = Counter(t for _, t in self.splits.get("train", []))
        if not counts:
            return False
        ratio = max(counts.values()) / max(min(counts.values()), 1)
        return ratio >= self.config.balancing.imbalance_trigger_ratio * 2

    def _discover(self) -> dict[str, list[Path]]:
        if not self.root.exists():
            raise DatasetError(f"Dataset directory not found: {self.root}")

        display = slug_map()
        excluded = set(self.config.data.exclude_dirs)
        found: dict[str, list[Path]] = defaultdict(list)

        for slug in CATEGORY_SLUGS:
            if slug in excluded:
                continue
            # Flat layout (legacy / `fml labels apply`) plus the
            # `scripts/export_training_set.py` train|val subfolders.
            images = iter_images(self.root / slug, recursive=False)
            for split in ("train", "val"):
                images += iter_images(self.root / slug / split, recursive=False)
            images = sorted(set(images))
            if images:
                found[display[slug]] = images

        if not found:
            raise DatasetError(
                f"No labelled images found under {self.root}. "
                "Run 'fml prepare', label the images, then 'fml labels apply'."
            )

        too_small = {
            c: len(p) for c, p in found.items()
            if len(p) < self.config.data.min_images_per_class
        }
        if too_small:
            raise DatasetError(
                f"These categories have fewer than {self.config.data.min_images_per_class} "
                f"images: {too_small}. Label more images before training."
            )
        if len(found) < 2:
            raise DatasetError("At least two categories are required to train a classifier.")

        logger.info("Discovered %s images across %s categories",
            sum(len(v) for v in found.values()), len(found))
        return dict(found)

    def _count(self, items: list[tuple[Path, int]]) -> dict[str, int]:
        counter = Counter(self.classes[i] for _, i in items)
        return {c: counter.get(c, 0) for c in self.classes}
