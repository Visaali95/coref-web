"""Pydantic request/response models - these define the public API contract that
the TypeScript client mirrors."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field

class ErrorDetail(BaseModel):
    code: str = Field(..., examples=["validation_error"])
    message: str
    detail: Optional[Any] = None

class ErrorResponse(BaseModel):
    error: ErrorDetail

class HealthResponse(BaseModel):
    status: str = Field(..., examples=["ok"])
    version: str
    model_loaded: bool
    device: Optional[str] = None
    confidence_threshold: Optional[float] = None
    message: Optional[str] = None

class ModelInfoResponse(BaseModel):
    model_name: str
    model_path: str
    classes: list[str]
    num_classes: int
    image_size: int
    device: str
    confidence_threshold: float

class CategoriesResponse(BaseModel):
    categories: list[str]
    unknown_label: str
    count: int

class Prediction(BaseModel):
    image_id: str = Field(..., examples=["img_001"])
    category: str = Field(..., examples=["Office Furniture"])
    confidence: float = Field(..., examples=[0.94])
    page_number: Optional[int] = Field(None, examples=[12])
    status: str = Field(..., examples=["classified", "needs_review", "failed"])
    source_pdf: Optional[str] = None
    image_path: Optional[str] = None
    raw_category: Optional[str] = None
    probabilities: Optional[dict[str, float]] = None
    inference_ms: Optional[float] = None
    error: Optional[str] = None

class BatchSummary(BaseModel):
    total: int
    classified: int
    needs_review: int
    failed: int
    by_category: dict[str, int] = {}

class BatchResponse(BaseModel):
    summary: BatchSummary
    results: list[Prediction]

class PDFSummary(BaseModel):
    total_pages: int
    images_extracted: int
    duplicates_removed: int
    images_classified: int
    needs_review: int
    failed: int
    by_category: dict[str, int] = {}
    processing_seconds: float

class DuplicateGroup(BaseModel):
    representative: str
    duplicates: list[str]

class PDFResponse(BaseModel):
    job_id: str
    source_pdf: str
    status: str
    summary: PDFSummary
    extraction_rejections: dict[str, int] = {}
    duplicate_groups: list[DuplicateGroup] = []
    results: list[Prediction]

class ExtractedImageInfo(BaseModel):
    image_id: str
    source_pdf: str
    page_number: int
    image_path: str
    width: int
    height: int
    extraction_method: str
    perceptual_hash: str
    is_duplicate: bool
    duplicate_of: Optional[str] = None

class ExtractResponse(BaseModel):
    job_id: str
    source_pdf: str
    total_pages: int
    images_extracted: int
    unique_images: int
    duplicates_removed: int
    extraction_rejections: dict[str, int] = {}
    images: list[ExtractedImageInfo]
