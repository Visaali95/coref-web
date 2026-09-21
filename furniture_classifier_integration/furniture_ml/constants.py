"""Project-wide constants: the canonical category taxonomy."""

from __future__ import annotations

# Canonical, ordered category list. The training pipeline exports the label
# mapping to models/labels.json - that exported file is the source of truth at
# inference time, this list is the source of truth for dataset scaffolding.
CATEGORIES: list[str] = [
"Office Furniture", "Villa Furniture", "Chandelier"
]

# Returned when the model's confidence is below the configured threshold.
UNKNOWN_LABEL = "Unknown"

STATUS_CLASSIFIED = "classified"
STATUS_NEEDS_REVIEW = "needs_review"
STATUS_FAILED = "failed"

# Filesystem-safe slug <-> display-name mapping (used for dataset directories).
def to_slug(category: str) -> str:
    return category.lower().replace(" and ", "_").replace(" ", "_")

def slug_map() -> dict[str, str]:
    """slug -> display name"""
    return {to_slug(c): c for c in CATEGORIES}

CATEGORY_SLUGS: list[str] = [to_slug(c) for c in CATEGORIES]

# Staging folder for images that have been extracted but not yet labelled.
UNLABELLED_DIR_NAME = "_unlabelled"
# Images explicitly marked as "not a product" during review (kept, never trained on).
REJECTED_DIR_NAME = "_rejected"

SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
