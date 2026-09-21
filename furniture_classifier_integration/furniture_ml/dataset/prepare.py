"""End-to-end dataset preparation: PDF(s) -> extraction -> dedup -> manifest ->
labelling staging area."""

from __future__ import annotations

import shutil
from dataclasses import dataclass, field
from pathlib import Path

from furniture_ml.config import Settings, get_settings
from furniture_ml.constants import UNLABELLED_DIR_NAME
from furniture_ml.dataset.manifest import Manifest
from furniture_ml.dedup import DedupConfig, ImageDeduplicator
from furniture_ml.exceptions import ValidationError
from furniture_ml.pdf import ExtractionConfig, PDFImageExtractor
from furniture_ml.utils.io_utils import ensure_dir, safe_stem, write_json
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)

@dataclass
class PrepareConfig:
    extraction: ExtractionConfig = field(default_factory=ExtractionConfig)
    dedup: DedupConfig = field(default_factory=DedupConfig)
    copy_to_staging: bool = True
    keep_duplicates_on_disk: bool = True

@dataclass
class PrepareResult:
    source_pdfs: list[str]
    extracted_dir: Path
    manifest_path: Path
    staging_dir: Path
    n_extracted: int
    n_unique: int
    n_duplicates: int
    rejection_reasons: dict[str, int]
    per_pdf: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "source_pdfs": self.source_pdfs,
            "extracted_dir": str(self.extracted_dir),
            "manifest_path": str(self.manifest_path),
            "staging_dir": str(self.staging_dir),
            "extracted_images": self.n_extracted,
            "unique_images": self.n_unique,
            "duplicates_removed": self.n_duplicates,
            "rejection_reasons": self.rejection_reasons,
            "per_pdf": self.per_pdf,
        }

class DatasetPreparer:
    """Turns raw catalogue PDFs into a clean, deduplicated, labellable dataset."""

    def __init__(self, settings: Settings | None = None, config: PrepareConfig | None = None):
        self.settings = settings or get_settings()
        self.config = config or PrepareConfig()

    # ------------------------------------------------------------------ API
    def prepare(self, pdfs: list[Path] | None = None) -> PrepareResult:
        settings = self.settings
        settings.ensure_dirs()

        pdf_paths = self._resolve_pdfs(pdfs)
        extractor = PDFImageExtractor(self.config.extraction)
        deduper = ImageDeduplicator(self.config.dedup)

        all_records = []
        rejections: dict[str, int] = {}
        per_pdf: list[dict] = []

        for pdf in pdf_paths:
            out_dir = ensure_dir(settings.extracted_dir / safe_stem(pdf.stem))
            summary = extractor.extract(pdf, out_dir)
            write_json(out_dir / "extraction_report.json", {
                "source_pdf": summary.source_pdf,
                "total_pages": summary.total_pages,
                "candidates": summary.n_candidates,
                "kept": len(summary.images),
                "rejected": summary.n_rejected,
                "rejection_reasons": summary.rejection_reasons,
                "duration_seconds": summary.duration_seconds,
                "pages": [p.__dict__ for p in summary.pages],
            })
            all_records.extend(summary.images)
            per_pdf.append({
                "pdf": pdf.name,
                "pages": summary.total_pages,
                "kept": len(summary.images),
                "rejected": summary.n_rejected,
            })
            for reason, count in summary.rejection_reasons.items():
                rejections[reason] = rejections.get(reason, 0) + count

        if not all_records:
            raise ValidationError(
                "No product images survived extraction. Loosen the filters in "
                "config/extraction.yaml (min_width/min_height/min_edge_density) "
                "or enable always_region_scan."
            )

        dedup_result = deduper.deduplicate(all_records)

        manifest = Manifest.from_records(dedup_result.records)
        manifest_path = settings.data_dir / "manifest.csv"
        manifest.save(manifest_path)
        manifest.save_json(settings.data_dir / "manifest.json")
        write_json(settings.artifacts_dir / "dedup_report.json", {
            **dedup_result.summary(),
            "groups": [
                {"representative": g.representative, "duplicates": g.members}
                for g in dedup_result.groups
            ],
        })

        staging = ensure_dir(settings.dataset_dir / UNLABELLED_DIR_NAME)
        if self.config.copy_to_staging:
            self._stage(dedup_result.unique_records, staging)

        result = PrepareResult(
            source_pdfs=[p.name for p in pdf_paths],
            extracted_dir=settings.extracted_dir,
            manifest_path=manifest_path,
            staging_dir=staging,
            n_extracted=len(dedup_result.records),
            n_unique=dedup_result.n_unique,
            n_duplicates=dedup_result.n_exact_duplicates + dedup_result.n_near_duplicates,
            rejection_reasons=rejections,
            per_pdf=per_pdf,
        )
        write_json(settings.artifacts_dir / "prepare_report.json", result.to_dict())
        logger.info("Dataset prepared: %s", result.to_dict())
        return result

    # ------------------------------------------------------------- internals
    def _resolve_pdfs(self, pdfs: list[Path] | None) -> list[Path]:
        if pdfs:
            resolved = [Path(p) for p in pdfs]
        else:
            resolved = sorted(self.settings.raw_pdf_dir.glob("*.pdf"))
        missing = [p for p in resolved if not p.exists()]
        if missing:
            raise ValidationError(f"PDF(s) not found: {[str(m) for m in missing]}")
        if not resolved:
            raise ValidationError(
                f"No PDFs found. Drop your catalogue into {self.settings.raw_pdf_dir}"
            )
        return resolved

    @staticmethod
    def _stage(records, staging: Path) -> None:
        for record in records:
            src = Path(record.image_path)
            dst = staging / src.name
            if src.exists() and not dst.exists():
                shutil.copy2(src, dst)
