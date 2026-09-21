"""Manifest -> curation DB bridge (free/local, no model needed).

``fml prepare`` writes ``data/manifest.csv`` but never touches
``data/curation.db``. Only the inference pipeline (``fml pdf``, which needs a
trained model) upserts into the review queue. This module fills that gap so
similarity clustering (``fml cluster``) works straight after ``fml prepare``.

Idempotent: uses ``CurationStore.upsert_products`` keyed on ``image_id`` and
preserves any existing ``cluster_id`` already assigned in the DB.
"""

from __future__ import annotations

from pathlib import Path

from furniture_ml.config import Settings, get_settings
from furniture_ml.constants import CATEGORIES, STATUS_CLASSIFIED, STATUS_NEEDS_REVIEW
from furniture_ml.curation.store import get_store
from furniture_ml.dataset.manifest import Manifest
from furniture_ml.pdf.text_context import classify_text_snippet
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)


def _to_float(value: object) -> float:
    try:
        return float(str(value)) if str(value).strip() not in {"", "None"} else 0.0
    except (TypeError, ValueError):
        return 0.0


def ingest_manifest(
    manifest_path: str | Path | None = None,
    *,
    only_unique: bool = True,
    settings: Settings | None = None,
) -> dict:
    """Copy manifest rows into the SQLite review queue."""
    settings = settings or get_settings()
    path = Path(manifest_path) if manifest_path else settings.data_dir / "manifest.csv"
    if not path.exists():
        raise FileNotFoundError(
            f"Manifest not found at {path}. Run `fml prepare` first."
        )

    manifest = Manifest.load(path)
    rows = manifest.unique() if only_unique else list(manifest.rows)

    products: list[dict] = []
    missing = 0
    n_classified = 0
    for r in rows:
        if r.image_path and not Path(r.image_path).exists():
            missing += 1
        # --- keyword auto-classification (Chinese/English catalog text) ---
        # Priority: explicit human label > manifest suggested_category >
        # fresh classify_text_snippet() over the stored snippet (covers
        # manifests written before the lexicon expansion).
        matched: str | None = None
        confidence = 0.0
        label = (r.label or "").strip()
        if label in CATEGORIES:
            matched = label
            confidence = _to_float(r.confidence) or 0.95
        else:
            suggested = (r.suggested_category or "").strip()
            if suggested in CATEGORIES:
                matched = suggested
                confidence = 0.95
            elif (r.page_text_snippet or "").strip():
                cat, conf = classify_text_snippet(r.page_text_snippet)
                if cat:
                    matched = cat
                    confidence = conf
        raw_hint = (
            (r.suggested_category or "").strip()
            or (label or "").strip()
            or None
        )
        # Filename fallback: this pipeline's test catalog is office furniture.
        if matched is None and "office" in (r.source_pdf or "").lower():
            raw_hint = raw_hint or "Office Furniture"
        if matched is not None:
            category: str | None = matched
            status = STATUS_CLASSIFIED
            n_classified += 1
        else:
            category = None
            status = STATUS_NEEDS_REVIEW
            confidence = 0.0
        # Preserve explicitly failed rows (curator rejected logos/dividers).
        if r.status == "failed":
            status = "failed"
        products.append(
            {
                "image_id": r.image_id,
                "image_path": r.image_path,
                "source_pdf": r.source_pdf,
                "page_number": r.page_number,
                "category": category,
                "confidence": confidence,
                "status": status,
                "raw_category": raw_hint,
            }
        )

    store = get_store()
    upserted = store.upsert_products(products) if products else 0
    result = {
        "manifest": str(path),
        "manifest_rows": len(manifest.rows),
        "ingested": upserted,
        "only_unique": only_unique,
        "missing_files": missing,
        "classified": n_classified,
        "needs_review": store.count_products("needs_review"),
        "db": str(store.path),
        "total": store.count_products(),
    }
    logger.info("Manifest ingest: %s", result)
    return result
