"""Health, model info and taxonomy endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from furniture_ml import __version__
from furniture_ml.api.schemas import CategoriesResponse, HealthResponse, ModelInfoResponse
from furniture_ml.config import get_settings
from furniture_ml.constants import CATEGORIES, UNKNOWN_LABEL
from furniture_ml.inference.predictor import get_predictor
from furniture_ml.utils.device import device_info

router = APIRouter(tags=["system"])

@router.get("/health", response_model=HealthResponse, summary="Liveness / readiness probe")
def health() -> HealthResponse:
    settings = get_settings()
    try:
        predictor = get_predictor()
        return HealthResponse(
            status="ok",
            version=__version__,
            model_loaded=True,
            device=predictor.device,
            confidence_threshold=predictor.confidence_threshold,
        )
    except Exception as exc:
        # Service is up but cannot serve predictions yet (e.g. model not trained).
        return HealthResponse(
            status="degraded",
            version=__version__,
            model_loaded=False,
            device=device_info().get("device"),
            confidence_threshold=settings.confidence_threshold,
            message=str(exc),
        )

@router.get("/model/info", response_model=ModelInfoResponse, summary="Loaded model metadata")
def model_info() -> ModelInfoResponse:
    return ModelInfoResponse(**get_predictor().info)

@router.get("/categories", response_model=CategoriesResponse, summary="Supported categories")
def categories() -> CategoriesResponse:
    try:
        classes = get_predictor().classes
    except Exception:
        classes = CATEGORIES
    return CategoriesResponse(
        categories=classes, unknown_label=UNKNOWN_LABEL, count=len(classes)
    )
