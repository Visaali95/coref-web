"""Full PDF workflow:

PDF -> page processing -> image extraction -> duplicate removal -> preprocessing
-> classification -> confidence check -> category assignment -> JSON.
"""

from __future__ import annotations

import shutil
import time
from dataclasses import dataclass, field
from pathlib import Path

from furniture_ml.config import Settings, get_settings
from furniture_ml.dedup import DedupConfig, ImageDeduplicator
from furniture_ml.inference.predictor import Predictor, get_predictor
from furniture_ml.inference.schemas import PredictionResult
from furniture_ml.pdf import ExtractionConfig, PDFImageExtractor
from furniture_ml.utils.io_utils import ensure_dir, safe_stem, write_json
from furniture_ml.utils.logging_utils import get_logger
from furniture_ml.utils.validation import validate_pdf_path

logger = get_logger(__name__)


@dataclass
class PDFPipelineResult:
    job_id: str
    source_pdf: str
    total_pages: int
    images_extracted: int
    duplicates_removed: int
    images_classified: int
    needs_review: int
    failed: int
    results: list[PredictionResult] = field(default_factory=list)
    duplicate_groups: list[dict] = field(default_factory=list)
    rejection_reasons: dict[str, int] = field(default_factory=dict)
    processing_seconds: float = 0.0
    output_dir: str = ""

    def to_dict(self, include_probabilities: bool = False) -> dict:
        by_category: dict[str, int] = {}
        for r in self.results:
            by_category[r.category] = by_category.get(r.category, 0) + 1
        return {
            "job_id": self.job_id,
            "source_pdf": self.source_pdf,
            "status": "completed",
            "summary": {
                "total_pages": self.total_pages,
                "images_extracted": self.images_extracted,
                "duplicates_removed": self.duplicates_removed,
                "images_classified": self.images_classified,
                "needs_review": self.needs_review,
                "failed": self.failed,
                "by_category": by_category,
                "processing_seconds": round(self.processing_seconds, 3),
            },
            "extraction_rejections": self.rejection_reasons,
            "duplicate_groups": self.duplicate_groups,
            "results": [r.to_dict(include_probabilities) for r in self.results],
        }


class PDFClassificationPipeline:
    def __init__(
        self,
        predictor: Predictor | None = None,
        *,
        settings: Settings | None = None,
        extraction: ExtractionConfig | None = None,
        dedup: DedupConfig | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.predictor = predictor or get_predictor()
        self.extractor = PDFImageExtractor(extraction or ExtractionConfig())
        self.deduper = ImageDeduplicator(dedup or DedupConfig())

    def run(
        self,
        pdf_path: str | Path,
        *,
        job_id: str | None = None,
        output_dir: str | Path | None = None,
        threshold: float | None = None,
        deduplicate: bool = True,
        keep_files: bool = True,
    ) -> PDFPipelineResult:
        started = time.perf_counter()
        pdf_path = validate_pdf_path(Path(pdf_path))
        job_id = job_id or f"job_{int(time.time() * 1000)}"
        out_dir = ensure_dir(
            Path(output_dir) if output_dir
            else self.settings.data_dir / "jobs" / f"{safe_stem(pdf_path.stem)}_{job_id}"
        )

        summary = self.extractor.extract(pdf_path, out_dir)
        records = summary.images

        duplicate_groups: list[dict] = []
        duplicates_removed = 0
        if deduplicate and records:
            dedup_result = self.deduper.deduplicate(records)
            records = dedup_result.unique_records
            duplicates_removed = (
                dedup_result.n_exact_duplicates + dedup_result.n_near_duplicates
            )
            duplicate_groups = [
                {"representative": g.representative, "duplicates": g.members}
                for g in dedup_result.groups
            ]

        results: list[PredictionResult] = []
        if records:
            results = self.predictor.predict_batch(
                [r.image_path for r in records],
                image_ids=[r.image_id for r in records],
                page_numbers=[r.page_number for r in records],
                source_pdfs=[r.source_pdf for r in records],
                threshold=threshold,
            )
            for record, prediction in zip(records, results):
                record.category = prediction.category
                record.confidence = prediction.confidence
                record.status = prediction.status

        result = PDFPipelineResult(
            job_id=job_id,
            source_pdf=pdf_path.name,
            total_pages=summary.total_pages,
            images_extracted=len(summary.images),
            duplicates_removed=duplicates_removed,
            images_classified=sum(1 for r in results if r.status == "classified"),
            needs_review=sum(1 for r in results if r.status == "needs_review"),
            failed=sum(1 for r in results if r.status == "failed"),
            results=results,
            duplicate_groups=duplicate_groups,
            rejection_reasons=summary.rejection_reasons,
            processing_seconds=time.perf_counter() - started,
            output_dir=str(out_dir),
        )

        write_json(out_dir / "results.json", result.to_dict())
        # Best-effort curation upsert so every PDF lands in the admin review queue.
        try:
            from furniture_ml.curation.store import get_store

            get_store().upsert_products(
                [
                    {
                        "image_id": r.image_id,
                        "image_path": getattr(r, "image_path", None),
                        "source_pdf": getattr(r, "source_pdf", None) or result.source_pdf,
                        "page_number": r.page_number,
                        "category": r.category,
                        "confidence": r.confidence,
                        "status": r.status,
                        "raw_category": getattr(r, "raw_category", None),
                    }
                    for r in results
                ]
            )
        except Exception:  # pragma: no cover - curation must never break inference
            logger.exception("Curation upsert failed")
        if not keep_files:
            shutil.rmtree(out_dir, ignore_errors=True)
            result.output_dir = ""

        logger.info(
            "PDF %s processed: %s pages, %s images, %s duplicates, %s needs review",
            pdf_path.name, result.total_pages, result.images_extracted,
            result.duplicates_removed, result.needs_review,
        )
        return result
