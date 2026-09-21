"""Curation DB -> training-set export bridge.

Copies every verified product (``status='classified'`` with a canonical
``category``) into ``data/dataset/<category_slug>/train|val/`` with a
deterministic 80/20 split, then reports per-class counts and warns about
classes too small to train on (upload more via the Admin UI instead).
"""

from __future__ import annotations

import random
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from furniture_ml.config import Settings, get_settings
from furniture_ml.constants import CATEGORIES, STATUS_CLASSIFIED, to_slug
from furniture_ml.curation.store import CurationStore, get_store
from furniture_ml.utils.io_utils import ensure_dir, write_json
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)

MIN_IMAGES_PER_CLASS = 10
TRAIN_SPLIT = "train"
VAL_SPLIT = "val"


@dataclass
class ExportReport:
    dataset_dir: str
    train_ratio: float
    seed: int
    per_class: dict[str, dict[str, int]] = field(default_factory=dict)
    totals: dict[str, int] = field(default_factory=dict)
    missing_files: int = 0
    small_classes: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "dataset_dir": self.dataset_dir,
            "train_ratio": self.train_ratio,
            "seed": self.seed,
            "per_class": self.per_class,
            "totals": self.totals,
            "missing_files": self.missing_files,
            "small_classes": self.small_classes,
            "warnings": self.warnings,
        }


def export_training_set(
    *,
    train_ratio: float = 0.8,
    seed: int = 42,
    min_per_class: int = MIN_IMAGES_PER_CLASS,
    dataset_dir: str | Path | None = None,
    settings: Settings | None = None,
    store: CurationStore | None = None,
) -> dict[str, Any]:
    """Export verified curation rows into a train/val folder dataset."""
    settings = settings or get_settings()
    root = Path(dataset_dir) if dataset_dir else settings.dataset_dir
    store = store or get_store()

    report = ExportReport(dataset_dir=str(root), train_ratio=train_ratio, seed=seed)
    rng = random.Random(seed)
    totals = {"train": 0, "val": 0, "total": 0}

    for category in CATEGORIES:
        products = store.list_products(
            status=STATUS_CLASSIFIED, category=category, limit=100_000
        )
        # Deterministic order before the seeded split.
        products = sorted(products, key=lambda p: p["image_id"])
        rng.shuffle(products)

        n = len(products)
        n_train = int(round(n * train_ratio)) if n else 0
        if 0 < n and n_train == 0:
            n_train = 1 # never starve train when a class is tiny
        if 0 < n and n - n_train == 0 and n >= 2:
            n_train = n - 1 # keep at least one val sample when possible
        train_rows = products[:n_train]
        val_rows = products[n_train:]

        counts = {"train": 0, "val": 0, "total": n}
        for split, rows in ((TRAIN_SPLIT, train_rows), (VAL_SPLIT, val_rows)):
            dest_dir = ensure_dir(root / to_slug(category) / split)
            for p in rows:
                src = Path(str(p.get("image_path") or ""))
                if not src.exists():
                    report.missing_files += 1
                    logger.warning("Missing file, skipped: %s", src)
                    continue
                dest = dest_dir / f"{p['image_id']}{src.suffix.lower()}"
                if not dest.exists():
                    shutil.copy2(src, dest)
                counts[split] += 1
        report.per_class[category] = counts
        totals["train"] += counts["train"]
        totals["val"] += counts["val"]
        totals["total"] += counts["total"]

        if n < min_per_class:
            report.small_classes.append(category)
            report.warnings.append(
                f"'{category}' has only {n} verified images "
                f"(needs {min_per_class}). Add custom uploads via the Admin UI "
                f"('Add custom product' page) before training."
            )

    report.totals = totals
    write_json(root / "export_report.json", report.to_dict())
    logger.info("Training-set export: %s", report.to_dict())
    return report.to_dict()
