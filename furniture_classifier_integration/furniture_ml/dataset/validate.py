"""Dataset validation - run this before training."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image

from furniture_ml.config import Settings, get_settings
from furniture_ml.constants import (
    CATEGORIES,
    CATEGORY_SLUGS,
    REJECTED_DIR_NAME,
    UNLABELLED_DIR_NAME,
    slug_map,
)
from furniture_ml.dedup.hashing import compute_hashes
from furniture_ml.utils.io_utils import iter_images
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)

@dataclass
class DatasetReport:
    root: str
    counts: dict[str, int] = field(default_factory=dict)
    total: int = 0
    corrupt: list[str] = field(default_factory=list)
    tiny: list[str] = field(default_factory=list)
    cross_class_duplicates: list[dict] = field(default_factory=list)
    empty_categories: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors

    def to_dict(self) -> dict:
        return {
            "root": self.root,
            "total_images": self.total,
            "counts": self.counts,
            "empty_categories": self.empty_categories,
            "corrupt_images": self.corrupt,
            "undersized_images": self.tiny,
            "cross_class_duplicates": self.cross_class_duplicates,
            "warnings": self.warnings,
            "errors": self.errors,
            "ok": self.ok,
        }

def validate_dataset(
    settings: Settings | None = None,
    *,
    min_per_class: int = 20,
    min_side: int = 64,
    check_cross_class_duplicates: bool = True,
) -> DatasetReport:
    settings = settings or get_settings()
    root = settings.dataset_dir
    report = DatasetReport(root=str(root))

    if not root.exists():
        report.errors.append(f"Dataset directory does not exist: {root}")
        return report

    display = slug_map()
    hashes: dict[str, tuple[str, str]] = {} # phash -> (category, path)

    for slug in CATEGORY_SLUGS:
        category = display[slug]
        folder = root / slug
        images = iter_images(folder, recursive=False)
        report.counts[category] = len(images)
        report.total += len(images)

        if not images:
            report.empty_categories.append(category)
            continue

        for image_path in images:
            try:
                with Image.open(image_path) as img:
                    img.verify()
                with Image.open(image_path) as img:
                    width, height = img.size
                    rgb = img.convert("RGB")
            except Exception as exc:
                report.corrupt.append(f"{image_path}: {exc}")
                continue

            if min(width, height) < min_side:
                report.tiny.append(str(image_path))

            if check_cross_class_duplicates:
                phash = compute_hashes(rgb).phash
                prior = hashes.get(phash)
                if prior and prior[0] != category:
                    report.cross_class_duplicates.append(
                        {
                            "phash": phash,
                            "a": {"category": prior[0], "path": prior[1]},
                            "b": {"category": category, "path": str(image_path)},
                        }
                    )
                hashes.setdefault(phash, (category, str(image_path)))

    # ---- verdicts ----------------------------------------------------
    if report.empty_categories:
        report.errors.append(
            f"No labelled images for: {report.empty_categories}. "
            "Training requires at least one example per category."
        )
    for category, count in report.counts.items():
        if 0 < count < min_per_class:
            report.warnings.append(
                f"'{category}' has only {count} images (recommended >= {min_per_class}). "
                "Expect weak accuracy for this class."
            )
    if report.counts:
        non_zero = [c for c in report.counts.values() if c]
        if non_zero and max(non_zero) / max(min(non_zero), 1) > 10:
            report.warnings.append(
                "Severe class imbalance (>10:1). Enable class weighting or a balanced "
                "sampler in config/training.yaml."
            )
    if report.corrupt:
        report.warnings.append(f"{len(report.corrupt)} unreadable image(s) will be skipped.")
    if report.cross_class_duplicates:
        report.warnings.append(
            f"{len(report.cross_class_duplicates)} identical image(s) appear in more than "
            "one category - fix these labels, they poison training and leak into validation."
        )

    staging = root / UNLABELLED_DIR_NAME
    pending = len(iter_images(staging, recursive=False))
    if pending:
        report.warnings.append(f"{pending} image(s) still awaiting labels in {staging}.")

    rejected = len(iter_images(root / REJECTED_DIR_NAME, recursive=False))
    if rejected:
        report.warnings.append(f"{rejected} image(s) marked as rejected (excluded from training).")

    logger.info("Dataset validation: %s images, ok=%s", report.total, report.ok)
    return report

def class_distribution(root: Path) -> Counter:
    display = slug_map()
    counter: Counter = Counter()
    for slug, category in display.items():
        counter[category] = len(iter_images(root / slug, recursive=False))
    return counter
