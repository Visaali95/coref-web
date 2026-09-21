"""Inference result schema - matches the JSON returned by the API verbatim."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from furniture_ml.constants import STATUS_CLASSIFIED, STATUS_FAILED, STATUS_NEEDS_REVIEW


@dataclass
class PredictionResult:
    image_id: str
    category: str
    confidence: float
    page_number: Optional[int] = None
    status: str = STATUS_CLASSIFIED

    # optional extras (omitted from the compact payload unless requested)
    source_pdf: Optional[str] = None
    image_path: Optional[str] = None
    raw_category: Optional[str] = None  # argmax label before thresholding
    probabilities: dict[str, float] = field(default_factory=dict)
    error: Optional[str] = None
    inference_ms: Optional[float] = None

    def to_dict(self, include_probabilities: bool = False) -> dict:
        payload: dict = {
            "image_id": self.image_id,
            "category": self.category,
            "confidence": round(float(self.confidence), 4),
            "page_number": self.page_number,
            "status": self.status,
        }
        if self.source_pdf:
            payload["source_pdf"] = self.source_pdf
        if self.image_path:
            payload["image_path"] = self.image_path
        if self.raw_category and self.raw_category != self.category:
            payload["raw_category"] = self.raw_category
        if include_probabilities and self.probabilities:
            payload["probabilities"] = {
                k: round(float(v), 4) for k, v in self.probabilities.items()
            }
        if self.inference_ms is not None:
            payload["inference_ms"] = round(self.inference_ms, 2)
        if self.error:
            payload["error"] = self.error
        return payload

    @classmethod
    def failed(cls, image_id: str, error: str, page_number: int | None = None) -> "PredictionResult":
        return cls(
            image_id=image_id,
            category="Unknown",
            confidence=0.0,
            page_number=page_number,
            status=STATUS_FAILED,
            error=error,
        )


__all__ = ["PredictionResult", "STATUS_CLASSIFIED", "STATUS_NEEDS_REVIEW", "STATUS_FAILED"]
