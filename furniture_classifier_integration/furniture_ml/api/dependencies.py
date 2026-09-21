"""Shared API dependencies: predictor access, upload handling, validation."""

from __future__ import annotations

import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from fastapi import UploadFile

from furniture_ml.config import get_settings
from furniture_ml.exceptions import ModelNotFoundError, ValidationError
from furniture_ml.inference.predictor import Predictor, get_predictor
from furniture_ml.utils.io_utils import ensure_dir, safe_stem
from furniture_ml.utils.logging_utils import get_logger
from furniture_ml.utils.validation import (
    validate_image_bytes,
    validate_pdf_bytes,
    validate_threshold,
)

logger = get_logger(__name__)

MAX_BATCH_IMAGES = 100


def predictor_dependency() -> Predictor:
    try:
        return get_predictor()
    except ModelNotFoundError:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        raise ModelNotFoundError(f"Failed to load the model: {exc}") from exc


async def read_upload(file: UploadFile, max_bytes: int) -> bytes:
    data = await file.read()
    await file.close()
    if not data:
        raise ValidationError(f"Uploaded file '{file.filename}' is empty.")
    if len(data) > max_bytes:
        from furniture_ml.exceptions import FileTooLargeError

        raise FileTooLargeError(
            f"'{file.filename}' exceeds the {max_bytes // (1024 * 1024)} MB limit."
        )
    return data


async def read_image_upload(file: UploadFile) -> bytes:
    settings = get_settings()
    data = await read_upload(file, settings.max_upload_bytes)
    validate_image_bytes(data, settings.max_upload_bytes)
    return data


async def read_pdf_upload(file: UploadFile) -> bytes:
    settings = get_settings()
    if file.filename and not file.filename.lower().endswith(".pdf"):
        from furniture_ml.exceptions import UnsupportedFileError

        raise UnsupportedFileError(f"'{file.filename}' is not a .pdf file.")
    data = await read_upload(file, settings.max_upload_bytes)
    validate_pdf_bytes(data, settings.max_upload_bytes)
    return data


@contextmanager
def temp_pdf(data: bytes, filename: str | None) -> Iterator[Path]:
    settings = get_settings()
    upload_dir = ensure_dir(settings.upload_dir)
    stem = safe_stem(Path(filename or "upload").stem)
    handle = tempfile.NamedTemporaryFile(
        prefix=f"{stem}_", suffix=".pdf", dir=upload_dir, delete=False
    )
    path = Path(handle.name)
    try:
        handle.write(data)
        handle.close()
        yield path
    finally:
        path.unlink(missing_ok=True)


@contextmanager
def temp_image(data: bytes, filename: str | None) -> Iterator[Path]:
    settings = get_settings()
    upload_dir = ensure_dir(settings.upload_dir)
    stem = safe_stem(Path(filename or "upload").stem)
    suffix = Path(filename or "upload.jpg").suffix or ".jpg"
    handle = tempfile.NamedTemporaryFile(
        prefix=f"{stem}_", suffix=suffix, dir=upload_dir, delete=False
    )
    path = Path(handle.name)
    try:
        handle.write(data)
        handle.close()
        yield path
    finally:
        path.unlink(missing_ok=True)


def check_batch_size(files: list[UploadFile]) -> None:
    if not files:
        raise ValidationError("No files were uploaded. Use the 'files' form field.")
    if len(files) > MAX_BATCH_IMAGES:
        raise ValidationError(
            f"Batch limit exceeded: {len(files)} files (maximum {MAX_BATCH_IMAGES})."
        )


def resolve_threshold(value: float | None) -> float | None:
    return validate_threshold(value)
