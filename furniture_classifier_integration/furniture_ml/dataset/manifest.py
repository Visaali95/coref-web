"""The extraction manifest - the single source of truth linking every image back
to its PDF, page number, hashes, duplicate status and label."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable, Sequence

from furniture_ml.pdf.schemas import ExtractedImage
from furniture_ml.utils.io_utils import read_csv, write_csv, write_json

MANIFEST_COLUMNS = [
    "image_id",
    "source_pdf",
    "page_number",
    "image_path",
    "width",
    "height",
    "file_size_bytes",
    "extraction_method",
    "content_hash",
    "perceptual_hash",
    "difference_hash",
    "is_duplicate",
    "duplicate_of",
    "duplicate_kind",
    "duplicate_distance",
    "suggested_category",
    "label",
    "category",
    "confidence",
    "status",
    "page_text_snippet",
]

@dataclass
class ManifestRow:
    image_id: str
    source_pdf: str
    page_number: int
    image_path: str
    width: int = 0
    height: int = 0
    file_size_bytes: int = 0
    extraction_method: str = "embedded"
    content_hash: str = ""
    perceptual_hash: str = ""
    difference_hash: str = ""
    is_duplicate: bool = False
    duplicate_of: str = ""
    duplicate_kind: str = ""
    duplicate_distance: str = ""
    suggested_category: str = ""
    label: str = ""
    category: str = ""
    confidence: str = ""
    status: str = "extracted"
    page_text_snippet: str = ""

    @classmethod
    def from_extracted(cls, record: ExtractedImage) -> "ManifestRow":
        return cls(
            image_id=record.image_id,
            source_pdf=record.source_pdf,
            page_number=record.page_number,
            image_path=record.image_path,
            width=record.width,
            height=record.height,
            file_size_bytes=record.file_size_bytes,
            extraction_method=record.extraction_method,
            content_hash=record.content_hash,
            perceptual_hash=record.perceptual_hash,
            difference_hash=record.difference_hash,
            is_duplicate=record.is_duplicate,
            duplicate_of=record.duplicate_of or "",
            duplicate_kind=record.duplicate_kind or "",
            duplicate_distance="" if record.duplicate_distance is None else str(record.duplicate_distance),
            suggested_category=(record.keyword_hints[0] if record.keyword_hints else ""),
            label=record.label or "",
            category=record.category or "",
            confidence="" if record.confidence is None else f"{record.confidence:.4f}",
            status=record.status,
            page_text_snippet=record.page_text_snippet,
        )

@dataclass
class Manifest:
    rows: list[ManifestRow] = field(default_factory=list)

    # ------------------------------------------------------------------ io
    @classmethod
    def from_records(cls, records: Iterable[ExtractedImage]) -> "Manifest":
        return cls(rows=[ManifestRow.from_extracted(r) for r in records])

    @classmethod
    def load(cls, path: str | Path) -> "Manifest":
        rows = []
        for raw in read_csv(Path(path)):
            data = {k: raw.get(k, "") for k in MANIFEST_COLUMNS}
            data["page_number"] = int(data["page_number"] or 0)
            data["width"] = int(data["width"] or 0)
            data["height"] = int(data["height"] or 0)
            data["file_size_bytes"] = int(data["file_size_bytes"] or 0)
            data["is_duplicate"] = str(data["is_duplicate"]).lower() in {"true", "1", "yes"}
            rows.append(ManifestRow(**data))
        return cls(rows=rows)

    def save(self, path: str | Path) -> Path:
        return write_csv(Path(path), [asdict(r) for r in self.rows], MANIFEST_COLUMNS)

    def save_json(self, path: str | Path) -> Path:
        return write_json(Path(path), [asdict(r) for r in self.rows])

    # -------------------------------------------------------------- queries
    def unique(self) -> list[ManifestRow]:
        return [r for r in self.rows if not r.is_duplicate]

    def labelled(self) -> list[ManifestRow]:
        return [r for r in self.unique() if r.label]

    def unlabelled(self) -> list[ManifestRow]:
        return [r for r in self.unique() if not r.label]

    def by_id(self) -> dict[str, ManifestRow]:
        return {r.image_id: r for r in self.rows}

    def merge_labels(self, labels: dict[str, str]) -> int:
        index = self.by_id()
        applied = 0
        for image_id, label in labels.items():
            row = index.get(image_id)
            if row is not None and label and row.label != label:
                row.label = label
                applied += 1
        return applied

    def extend(self, other: "Manifest") -> None:
        known = {r.image_id for r in self.rows}
        self.rows.extend(r for r in other.rows if r.image_id not in known)

    def counts_by_label(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for row in self.labelled():
            counts[row.label] = counts.get(row.label, 0) + 1
        return dict(sorted(counts.items()))

def merge_manifests(paths: Sequence[Path]) -> Manifest:
    merged = Manifest()
    for path in paths:
        merged.extend(Manifest.load(path))
    return merged
