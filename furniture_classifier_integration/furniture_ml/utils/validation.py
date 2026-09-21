"""Input & file validation shared by the CLI and the API."""

from __future__ import annotations

from pathlib import Path

from furniture_ml.constants import SUPPORTED_IMAGE_EXTENSIONS
from furniture_ml.exceptions import (
    FileTooLargeError,
    UnsupportedFileError,
    ValidationError,
)

PDF_MAGIC = b"%PDF-"
IMAGE_MAGICS: tuple[bytes, ...] = (
    b"\x89PNG\r\n\x1a\n",  # png
    b"\xff\xd8\xff",  # jpeg
    b"BM",  # bmp
    b"II*\x00",  # tiff le
    b"MM\x00*",  # tiff be
)


def validate_size(data: bytes, max_bytes: int, what: str = "file") -> None:
    if len(data) == 0:
        raise ValidationError(f"Empty {what} received.")
    if len(data) > max_bytes:
        raise FileTooLargeError(
            f"{what.capitalize()} exceeds the maximum allowed size of "
            f"{max_bytes / (1024 * 1024):.0f} MB.",
            detail={"size_bytes": len(data), "max_bytes": max_bytes},
        )


def validate_pdf_bytes(data: bytes, max_bytes: int) -> None:
    validate_size(data, max_bytes, "pdf")
    if not data.startswith(PDF_MAGIC):
        raise UnsupportedFileError("File does not look like a valid PDF (bad magic header).")


def validate_image_bytes(data: bytes, max_bytes: int) -> None:
    validate_size(data, max_bytes, "image")
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return
    if not any(data.startswith(m) for m in IMAGE_MAGICS):
        raise UnsupportedFileError(
            "Unsupported image format. Allowed: PNG, JPEG, WEBP, BMP, TIFF."
        )


def validate_image_path(path: Path) -> Path:
    p = Path(path)
    if not p.exists() or not p.is_file():
        raise ValidationError(f"Image not found: {p}")
    if p.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
        raise UnsupportedFileError(f"Unsupported image extension: {p.suffix}")
    return p


def validate_pdf_path(path: Path) -> Path:
    p = Path(path)
    if not p.exists() or not p.is_file():
        raise ValidationError(f"PDF not found: {p}")
    if p.suffix.lower() != ".pdf":
        raise UnsupportedFileError(f"Expected a .pdf file, got: {p.suffix}")
    return p


def validate_threshold(value: float | None) -> float | None:
    if value is None:
        return None
    if not 0.0 <= float(value) <= 1.0:
        raise ValidationError("confidence_threshold must be between 0.0 and 1.0")
    return float(value)
