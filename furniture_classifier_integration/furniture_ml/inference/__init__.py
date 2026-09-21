"""Standalone inference (no training dependencies required)."""

from furniture_ml.inference.schemas import PredictionResult
from furniture_ml.inference.predictor import Predictor, get_predictor
from furniture_ml.inference.pipeline import PDFClassificationPipeline, PDFPipelineResult

__all__ = [
"PredictionResult",
"Predictor",
"get_predictor",
"PDFClassificationPipeline",
"PDFPipelineResult",
]
