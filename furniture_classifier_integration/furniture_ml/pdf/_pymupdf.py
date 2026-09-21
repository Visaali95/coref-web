"""PyMuPDF import shim.

Recent PyMuPDF releases deprecate the legacy ``fitz`` alias in favour of
``pymupdf``. Import from here so the codebase works with both.
"""

from __future__ import annotations

try: # PyMuPDF >= 1.24.3
    import pymupdf as fitz # type: ignore
except ImportError: # pragma: no cover - older PyMuPDF
    import fitz # type: ignore

__all__ = ["fitz"]
