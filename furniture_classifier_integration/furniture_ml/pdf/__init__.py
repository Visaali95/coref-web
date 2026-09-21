"""PDF page processing and product-image extraction."""

from furniture_ml.pdf.schemas import ExtractedImage, ExtractionSummary, PageInfo
from furniture_ml.pdf.extractor import PDFImageExtractor, ExtractionConfig

__all__ = [
"ExtractedImage",
"ExtractionSummary",
"PageInfo",
"PDFImageExtractor",
"ExtractionConfig",
]
