"""Typed exceptions -> clean API error responses."""

from __future__ import annotations

class FurnitureMLError(Exception):
    """Base error. ``status_code`` maps directly to the HTTP response."""

    status_code = 500
    code = "internal_error"

    def __init__(self, message: str, *, detail: object | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail

    def to_dict(self) -> dict:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "detail": self.detail,
            }
        }

class ValidationError(FurnitureMLError):
    status_code = 400
    code = "validation_error"

class UnsupportedFileError(FurnitureMLError):
    status_code = 415
    code = "unsupported_file"

class FileTooLargeError(FurnitureMLError):
    status_code = 413
    code = "file_too_large"

class ModelNotFoundError(FurnitureMLError):
    status_code = 503
    code = "model_unavailable"

class PDFProcessingError(FurnitureMLError):
    status_code = 422
    code = "pdf_processing_error"

class DatasetError(FurnitureMLError):
    status_code = 400
    code = "dataset_error"
