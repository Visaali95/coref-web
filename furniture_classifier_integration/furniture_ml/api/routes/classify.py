"""Single and batch image classification endpoints."""

from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from furniture_ml.api.dependencies import (
    check_batch_size,
    read_image_upload,
    resolve_threshold,
)
from furniture_ml.api.schemas import BatchResponse, BatchSummary, Prediction
from furniture_ml.inference.predictor import get_predictor
from furniture_ml.inference.schemas import PredictionResult
from furniture_ml.utils.io_utils import new_image_id
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["classification"])

@router.post(
    "/classify",
    response_model=Prediction,
    response_model_exclude_none=True,
    summary="Classify a single image",
    description=(
        "Upload one image (`multipart/form-data`, field name `file`). Returns the "
        "predicted category, confidence and status. When the confidence is below "
        "`confidence_threshold`, `category` becomes `Unknown` and `status` becomes "
        "`needs_review`."
    ),
)
async def classify_image(
    file: UploadFile = File(..., description="Image file (PNG/JPEG/WEBP/BMP/TIFF)"),
    image_id: str | None = Form(None),
    page_number: int | None = Form(None),
    threshold: float | None = Form(None),
    include_probabilities: bool = Form(False),
) -> Prediction:
    data = await read_image_upload(file)
    predictor = get_predictor()
    result = predictor.predict(
        data,
        image_id=image_id or new_image_id(),
        page_number=page_number,
        threshold=resolve_threshold(threshold),
    )
    logger.info("classify %s -> %s (%.3f)", result.image_id, result.category, result.confidence)
    return Prediction(**result.to_dict(include_probabilities))

@router.post(
    "/classify/batch",
    response_model=BatchResponse,
    response_model_exclude_none=True,
    summary="Classify multiple images in one request",
    description=(
        "Upload up to 100 images (`multipart/form-data`, repeated field name `files`). "
        "Images that cannot be decoded are returned individually with "
        "`status=\"failed\"` - the request as a whole still succeeds."
    ),
)
async def classify_batch(
    files: list[UploadFile] = File(..., description="Image files"),
    threshold: float | None = Form(None),
    include_probabilities: bool = Form(False),
) -> BatchResponse:
    check_batch_size(files)
    predictor = get_predictor()

    payloads: list[bytes] = []
    ids: list[str] = []
    failures: list[PredictionResult] = []

    for upload in files:
        image_id = new_image_id()
        try:
            payloads.append(await read_image_upload(upload))
            ids.append(image_id)
        except Exception as exc:
            failures.append(
                PredictionResult.failed(image_id, f"{upload.filename}: {exc}")
            )

    results = (
        predictor.predict_batch(payloads, image_ids=ids, threshold=resolve_threshold(threshold))
        if payloads
        else []
    )
    results.extend(failures)

    by_category: dict[str, int] = {}
    for result in results:
        by_category[result.category] = by_category.get(result.category, 0) + 1

    return BatchResponse(
        summary=BatchSummary(
            total=len(results),
            classified=sum(1 for r in results if r.status == "classified"),
            needs_review=sum(1 for r in results if r.status == "needs_review"),
            failed=sum(1 for r in results if r.status == "failed"),
            by_category=by_category,
        ),
        results=[Prediction(**r.to_dict(include_probabilities)) for r in results],
    )
