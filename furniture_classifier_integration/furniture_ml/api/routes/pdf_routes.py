"""PDF upload, extraction and end-to-end classification endpoints."""

from __future__ import annotations

import time

from fastapi import APIRouter, File, Form, UploadFile
from starlette.concurrency import run_in_threadpool

from furniture_ml.api.dependencies import read_pdf_upload, resolve_threshold, temp_pdf
from furniture_ml.api.schemas import (
    ExtractedImageInfo,
    ExtractResponse,
    PDFResponse,
)
from furniture_ml.dedup import DedupConfig, ImageDeduplicator
from furniture_ml.inference.pipeline import PDFClassificationPipeline
from furniture_ml.pdf import ExtractionConfig, PDFImageExtractor
from furniture_ml.pipeline_config import load_pipeline_config
from furniture_ml.config import get_settings
from furniture_ml.utils.io_utils import ensure_dir, safe_stem
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/pdf", tags=["pdf"])

def _extraction_config(dpi: int, max_pages: int | None, region_fallback: bool) -> ExtractionConfig:
    """Start from config/pipeline.yaml, then apply the per-request overrides."""
    extraction, _ = load_pipeline_config()
    extraction.dpi = dpi
    extraction.max_pages = max_pages
    extraction.region_fallback = region_fallback
    return extraction

@router.post(
    "/process",
    response_model=PDFResponse,
    response_model_exclude_none=True,
    summary="Upload a PDF and classify every product image it contains",
    description=(
        "Runs the full workflow: page processing -> image extraction -> duplicate & "
        "near-duplicate removal -> preprocessing -> classification -> confidence check "
        "-> category assignment. Returns one result object per unique product image, "
        "each carrying its original `page_number`."
    ),
)
async def process_pdf(
    file: UploadFile = File(..., description="Catalogue PDF"),
    threshold: float | None = Form(None, description="Override the confidence threshold"),
    deduplicate: bool = Form(True),
    include_probabilities: bool = Form(False),
    keep_files: bool = Form(False, description="Persist extracted images on the server"),
    dpi: int = Form(200),
    max_pages: int | None = Form(None),
    region_fallback: bool = Form(True),
) -> PDFResponse:
    data = await read_pdf_upload(file)
    job_id = f"job_{int(time.time() * 1000)}"

    def _run() -> dict:
        with temp_pdf(data, file.filename) as pdf_path:
            pipeline = PDFClassificationPipeline(
                extraction=_extraction_config(dpi, max_pages, region_fallback)
            )
            result = pipeline.run(
                pdf_path,
                job_id=job_id,
                threshold=resolve_threshold(threshold),
                deduplicate=deduplicate,
                keep_files=keep_files,
            )
            payload = result.to_dict(include_probabilities)
            original_name = file.filename or pdf_path.name
            payload["source_pdf"] = original_name
            for item in payload["results"]:
                if item.get("source_pdf"):
                    item["source_pdf"] = original_name
            return payload

    payload = await run_in_threadpool(_run)
    return PDFResponse(**payload)

@router.post(
    "/extract",
    response_model=ExtractResponse,
    summary="Extract and deduplicate images from a PDF (no classification)",
    description=(
        "Useful for building a labelling dataset: returns the extracted product "
        "images with page numbers, hashes and duplicate flags. Requires no trained model."
    ),
)
async def extract_pdf(
    file: UploadFile = File(..., description="Catalogue PDF"),
    deduplicate: bool = Form(True),
    dpi: int = Form(200),
    max_pages: int | None = Form(None),
    region_fallback: bool = Form(True),
) -> ExtractResponse:
    data = await read_pdf_upload(file)
    job_id = f"job_{int(time.time() * 1000)}"
    settings = get_settings()

    def _run() -> ExtractResponse:
        with temp_pdf(data, file.filename) as pdf_path:
            out_dir = ensure_dir(
                settings.data_dir / "jobs" / f"{safe_stem(pdf_path.stem)}_{job_id}"
            )
            extractor = PDFImageExtractor(
                _extraction_config(dpi, max_pages, region_fallback)
            )
            summary = extractor.extract(pdf_path, out_dir)
            records = summary.images
            removed = 0
            if deduplicate and records:
                dedup = ImageDeduplicator(DedupConfig()).deduplicate(records)
                removed = dedup.n_exact_duplicates + dedup.n_near_duplicates

            return ExtractResponse(
                job_id=job_id,
                source_pdf=file.filename or pdf_path.name,
                total_pages=summary.total_pages,
                images_extracted=len(records),
                unique_images=sum(1 for r in records if not r.is_duplicate),
                duplicates_removed=removed,
                extraction_rejections=summary.rejection_reasons,
                images=[
                    ExtractedImageInfo(
                        image_id=r.image_id,
                        source_pdf=file.filename or r.source_pdf,
                        page_number=r.page_number,
                        image_path=r.image_path,
                        width=r.width,
                        height=r.height,
                        extraction_method=r.extraction_method,
                        perceptual_hash=r.perceptual_hash,
                        is_duplicate=r.is_duplicate,
                        duplicate_of=r.duplicate_of,
                    )
                    for r in records
                ],
            )

    return await run_in_threadpool(_run)
