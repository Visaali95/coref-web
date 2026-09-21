"""Manual labelling workflow.

Two interchangeable ways to label - use whichever you prefer:

A. **Folder drag & drop** - move files out of ``data/dataset/_unlabelled`` into the
category folders, then run ``fml labels sync`` to write the labels back into
the manifest.
B. **CSV / HTML review tool** - edit ``data/dataset/labels.csv`` (or use the
generated ``artifacts/review/review.html`` page), then run ``fml labels apply``
to materialise the ImageFolder layout.
"""

from __future__ import annotations

import shutil
from dataclasses import dataclass, field
from pathlib import Path

from furniture_ml.config import Settings, get_settings
from furniture_ml.constants import (
    CATEGORIES,
    CATEGORY_SLUGS,
    REJECTED_DIR_NAME,
    UNLABELLED_DIR_NAME,
    slug_map,
    to_slug,
)
from furniture_ml.dataset.manifest import Manifest
from furniture_ml.exceptions import DatasetError
from furniture_ml.utils.io_utils import ensure_dir, read_csv, write_csv
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)

LABELS_COLUMNS = [
    "image_id",
    "image_path",
    "source_pdf",
    "page_number",
    "suggested_category",
    "label",
    "notes",
]

def scaffold_dataset_dirs(settings: Settings | None = None) -> list[Path]:
    """Create ``data/dataset/<category>`` folders + staging/rejected folders."""
    settings = settings or get_settings()
    created = []
    for slug in CATEGORY_SLUGS + [UNLABELLED_DIR_NAME, REJECTED_DIR_NAME]:
        path = ensure_dir(settings.dataset_dir / slug)
        created.append(path)
    (settings.dataset_dir / "README.txt").write_text(
        "Place each image in exactly one category folder.\n"
        "Folder -> category mapping:\n"
        + "\n".join(f" {to_slug(c):<28} = {c}" for c in CATEGORIES)
        + f"\n {UNLABELLED_DIR_NAME:<28} = not yet reviewed"
        + f"\n {REJECTED_DIR_NAME:<28} = not a product image (never trained on)\n",
        encoding="utf-8",
    )
    return created

@dataclass
class LabelStore:
    """Reads/writes ``labels.csv``, the human-editable labelling worksheet."""

    path: Path
    rows: list[dict] = field(default_factory=list)

    @classmethod
    def build(cls, manifest: Manifest, path: Path) -> "LabelStore":
        existing = {r["image_id"]: r for r in read_csv(path)} if path.exists() else {}
        rows = []
        for row in manifest.unique():
            prior = existing.get(row.image_id, {})
            rows.append(
                {
                    "image_id": row.image_id,
                    "image_path": row.image_path,
                    "source_pdf": row.source_pdf,
                    "page_number": row.page_number,
                    "suggested_category": row.suggested_category,
                    "label": prior.get("label") or row.label or "",
                    "notes": prior.get("notes", ""),
                }
            )
        store = cls(path=path, rows=rows)
        store.save()
        return store

    @classmethod
    def load(cls, path: Path) -> "LabelStore":
        if not Path(path).exists():
            raise DatasetError(f"labels.csv not found at {path}. Run 'fml prepare' first.")
        return cls(path=Path(path), rows=read_csv(path))

    def save(self) -> Path:
        return write_csv(self.path, self.rows, LABELS_COLUMNS)

    def labels(self) -> dict[str, str]:
        valid = set(CATEGORIES)
        out: dict[str, str] = {}
        unknown: set[str] = set()
        for row in self.rows:
            label = (row.get("label") or "").strip()
            if not label:
                continue
            if label in valid:
                out[row["image_id"]] = label
            elif label.lower() in {"reject", "rejected", "none", "not_product"}:
                out[row["image_id"]] = REJECTED_DIR_NAME
            else:
                unknown.add(label)
        if unknown:
            raise DatasetError(
                "Unknown category label(s) in labels.csv: "
                f"{sorted(unknown)}. Allowed: {CATEGORIES}"
            )
        return out

def apply_labels(settings: Settings | None = None, move: bool = False) -> dict:
    """Materialise the ImageFolder dataset from ``labels.csv``."""
    settings = settings or get_settings()
    scaffold_dataset_dirs(settings)

    manifest_path = settings.data_dir / "manifest.csv"
    if not manifest_path.exists():
        raise DatasetError(f"Manifest not found at {manifest_path}. Run 'fml prepare' first.")

    manifest = Manifest.load(manifest_path)
    store = LabelStore.load(settings.dataset_dir / "labels.csv")
    labels = store.labels()

    index = manifest.by_id()
    counts: dict[str, int] = {}
    missing: list[str] = []

    for image_id, label in labels.items():
        row = index.get(image_id)
        if row is None:
            missing.append(image_id)
            continue
        src = Path(row.image_path)
        if not src.exists():
            missing.append(image_id)
            continue
        folder = REJECTED_DIR_NAME if label == REJECTED_DIR_NAME else to_slug(label)
        dst_dir = ensure_dir(settings.dataset_dir / folder)
        dst = dst_dir / src.name
        if not dst.exists():
            (shutil.move if move else shutil.copy2)(str(src), str(dst))
        counts[label] = counts.get(label, 0) + 1
        if label != REJECTED_DIR_NAME:
            row.label = label

    # Remove now-labelled images from the staging folder.
    staging = settings.dataset_dir / UNLABELLED_DIR_NAME
    for image_id in labels:
        row = index.get(image_id)
        if row is None:
            continue
        stale = staging / Path(row.image_path).name
        if stale.exists():
            stale.unlink()

    manifest.save(manifest_path)
    result = {"applied": sum(counts.values()), "per_category": counts, "missing": missing}
    logger.info("Applied labels: %s", result)
    return result

def sync_from_folders(settings: Settings | None = None) -> dict:
    """Reverse direction: read the category folders and update manifest + labels.csv."""
    settings = settings or get_settings()
    manifest_path = settings.data_dir / "manifest.csv"
    if not manifest_path.exists():
        raise DatasetError(f"Manifest not found at {manifest_path}. Run 'fml prepare' first.")

    manifest = Manifest.load(manifest_path)
    by_filename = {Path(r.image_path).name: r for r in manifest.rows}
    display = slug_map()

    counts: dict[str, int] = {}
    for slug, category in display.items():
        folder = settings.dataset_dir / slug
        if not folder.exists():
            continue
        for image in folder.iterdir():
            if not image.is_file():
                continue
            row = by_filename.get(image.name)
            if row is not None:
                row.label = category
                counts[category] = counts.get(category, 0) + 1

    manifest.save(manifest_path)
    store = LabelStore.build(manifest, settings.dataset_dir / "labels.csv")
    for row in store.rows:
        record = by_filename.get(Path(row["image_path"]).name)
        if record is not None and record.label:
            row["label"] = record.label
    store.save()
    logger.info("Synced labels from folders: %s", counts)
    return {"per_category": counts, "total": sum(counts.values())}

def labelling_status(settings: Settings | None = None) -> dict:
    settings = settings or get_settings()
    manifest_path = settings.data_dir / "manifest.csv"
    if not manifest_path.exists():
        return {"error": f"No manifest at {manifest_path}. Run 'fml prepare' first."}

    manifest = Manifest.load(manifest_path)
    unique = manifest.unique()
    labelled = manifest.labelled()
    counts = manifest.counts_by_label()
    missing_categories = [c for c in CATEGORIES if counts.get(c, 0) == 0]

    return {
        "total_extracted": len(manifest.rows),
        "duplicates": len(manifest.rows) - len(unique),
        "unique": len(unique),
        "labelled": len(labelled),
        "unlabelled": len(unique) - len(labelled),
        "per_category": counts,
        "categories_with_no_examples": missing_categories,
        "ready_for_training": not missing_categories and len(labelled) >= len(CATEGORIES) * 20,
    }
