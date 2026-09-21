"""Dataclasses describing everything extracted from a PDF."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

@dataclass
class PageInfo:
    page_number: int # 1-based
    width: float
    height: float
    n_embedded_images: int = 0
    n_kept_images: int = 0
    text_snippet: str = ""

@dataclass
class ExtractedImage:
    """One candidate product image pulled out of a PDF page.

    ``category`` / ``confidence`` stay ``None`` until classification runs;
    ``label`` stays ``None`` until a human labels it.
    """

    image_id: str
    source_pdf: str
    page_number: int
    image_path: str

    width: int
    height: int
    file_size_bytes: int
    image_format: str

    # provenance
    extraction_method: str = "embedded" # embedded | rendered_region | full_page
    xref: Optional[int] = None
    bbox: Optional[list[float]] = None # [x0, y0, x1, y1] in PDF points
    occurrence_index: int = 0

    # deduplication
    content_hash: str = "" # sha256 of the decoded pixel bytes
    perceptual_hash: str = "" # pHash hex
    difference_hash: str = "" # dHash hex
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None
    duplicate_kind: Optional[str] = None # exact | near
    duplicate_distance: Optional[int] = None

    # quality signals used by the relevance filter
    quality: dict = field(default_factory=dict)

    # human/ML labels
    label: Optional[str] = None # ground truth, set during labelling
    category: Optional[str] = None # model prediction
    confidence: Optional[float] = None
    status: str = "extracted"

    # context (metadata only - never auto-used as a label)
    page_text_snippet: str = ""
    keyword_hints: list[str] = field(default_factory=list)

@dataclass
class ExtractionSummary:
    source_pdf: str
    total_pages: int
    pages: list[PageInfo] = field(default_factory=list)
    images: list[ExtractedImage] = field(default_factory=list)
    n_candidates: int = 0
    n_rejected: int = 0
    n_duplicates: int = 0
    n_unique: int = 0
    rejection_reasons: dict[str, int] = field(default_factory=dict)
    duration_seconds: float = 0.0

    @property
    def unique_images(self) -> list[ExtractedImage]:
        return [i for i in self.images if not i.is_duplicate]
