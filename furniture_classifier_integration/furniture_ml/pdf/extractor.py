"""PDF -> product image extraction.

Two complementary strategies:

1. **Embedded image extraction** (primary) - pulls the raw bitmap XObjects out of
each page with PyMuPDF, keeping the exact placement rectangle so the image can
be traced back to its position on the page.
2. **Rendered region detection** (fallback) - when a page yields no usable
embedded bitmap (vector artwork, single flattened background image), the page
is rasterised and connected non-background regions are segmented out.

Both strategies feed the same relevance filter, so logos, icons, rules,
backgrounds and text blocks are dropped.
"""

from __future__ import annotations

import io
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image

from furniture_ml.exceptions import PDFProcessingError
from furniture_ml.pdf.filters import FilterConfig, assess
from furniture_ml.pdf.schemas import ExtractedImage, ExtractionSummary, PageInfo
from furniture_ml.pdf.text_context import (
    clean_text,
    extract_nearby_text,
    keyword_hints,
    text_near_bbox,
)
from furniture_ml.utils.io_utils import ensure_dir, new_image_id, safe_stem, sha256_bytes
from furniture_ml.utils.logging_utils import get_logger
from furniture_ml.utils.validation import validate_pdf_path

logger = get_logger(__name__)

Image.MAX_IMAGE_PIXELS = 300_000_000


def _bbox_iou(a: list[float] | tuple, b: list[float] | tuple) -> float:
    """Intersection-over-union for ``[x0, y0, x1, y1]`` boxes (PDF points)."""
    try:
        ax0, ay0, ax1, ay1 = (float(v) for v in a)
        bx0, by0, bx1, by1 = (float(v) for v in b)
        ix0, iy0 = max(ax0, bx0), max(ay0, by0)
        ix1, iy1 = min(ax1, bx1), min(ay1, by1)
        inter = max(0.0, ix1 - ix0) * max(0.0, iy1 - iy0)
        if inter <= 0:
            return 0.0
        union = (ax1 - ax0) * (ay1 - ay0) + (bx1 - bx0) * (by1 - by0) - inter
        return inter / union if union > 0 else 0.0
    except Exception:
        return 0.0

@dataclass
class ExtractionConfig:
    dpi: int = 200
    save_format: str = "PNG" # PNG keeps quality; JPEG saves disk
    jpeg_quality: int = 92
    max_pages: int | None = None
    page_range: tuple[int, int] | None = None # 1-based inclusive
    extract_embedded: bool = True
    region_fallback: bool = True # rasterise pages that yield nothing
    always_region_scan: bool = False # rasterise every page as well
    capture_text_context: bool = True
    max_images_per_page: int = 40
    max_side: int = 2048 # downscale enormous bitmaps on save
    filters: FilterConfig = field(default_factory=FilterConfig)

class PDFImageExtractor:
    """Extract candidate product images from a PDF, page by page."""

    def __init__(self, config: ExtractionConfig | None = None) -> None:
        self.config = config or ExtractionConfig()

    # ------------------------------------------------------------------ API
    def extract(self, pdf_path: str | Path, output_dir: str | Path) -> ExtractionSummary:
        from furniture_ml.pdf._pymupdf import fitz # lazy: keeps training envs light

        pdf_path = validate_pdf_path(Path(pdf_path))
        out_images = ensure_dir(Path(output_dir) / "images")
        started = time.perf_counter()

        try:
            doc = fitz.open(pdf_path)
        except Exception as exc: # pragma: no cover - corrupt file path
            raise PDFProcessingError(f"Could not open PDF: {exc}") from exc

        if doc.is_encrypted and not doc.authenticate(""):
            doc.close()
            raise PDFProcessingError("PDF is password protected and cannot be processed.")

        summary = ExtractionSummary(source_pdf=pdf_path.name, total_pages=doc.page_count)
        rejects: dict[str, int] = {}

        try:
            for page_index in self._page_indices(doc.page_count):
                page = doc.load_page(page_index)
                page_no = page_index + 1
                info = PageInfo(
                    page_number=page_no,
                    width=float(page.rect.width),
                    height=float(page.rect.height),
                )
                if self.config.capture_text_context:
                    info.text_snippet = clean_text(page.get_text("text"), 300)

                candidates: list[tuple[Image.Image, dict]] = []
                if self.config.extract_embedded:
                    embedded = list(self._iter_embedded(doc, page))
                    info.n_embedded_images = len(embedded)
                    candidates.extend(embedded)

                kept_from_embedded = self._collect(
                    candidates, page, page_no, pdf_path, out_images, summary, rejects
                )

                need_fallback = self.config.always_region_scan or (
                    self.config.region_fallback and kept_from_embedded == 0
                )
                if need_fallback:
                    regions = list(self._iter_regions(page))
                    if kept_from_embedded > 0:
                        # Suppress region crops that re-capture an already-kept
                        # embedded image plus its caption text box (the classic
                        # clean-product vs product+SKU-text near-duplicate pair).
                        embedded_boxes = [
                            r.bbox for r in summary.images
                            if r.page_number == page_no and r.bbox
                        ]
                        filtered: list[tuple[Image.Image, dict]] = []
                        for image, meta in regions:
                            if meta.get("bbox") and any(
                                _bbox_iou(meta["bbox"], eb) > 0.30 for eb in embedded_boxes
                            ):
                                rejects["region_overlaps_embedded"] = rejects.get(
                                    "region_overlaps_embedded", 0) + 1
                                continue
                            filtered.append((image, meta))
                        regions = filtered
                    kept_from_regions = self._collect(
                        regions, page, page_no, pdf_path, out_images, summary, rejects
                    )
                else:
                    kept_from_regions = 0

                info.n_kept_images = kept_from_embedded + kept_from_regions
                summary.pages.append(info)
                logger.debug(
                    "page %s/%s: embedded=%s kept=%s",
                    page_no, doc.page_count, info.n_embedded_images, info.n_kept_images,
                )
        finally:
            doc.close()

        summary.rejection_reasons = dict(sorted(rejects.items(), key=lambda kv: -kv[1]))
        summary.n_rejected = sum(rejects.values())
        summary.n_candidates = len(summary.images) + summary.n_rejected
        summary.n_unique = len(summary.images)
        summary.duration_seconds = round(time.perf_counter() - started, 3)
        logger.info(
            "Extracted %s images from %s (%s pages, %s rejected) in %.2fs",
            len(summary.images), pdf_path.name, summary.total_pages,
            summary.n_rejected, summary.duration_seconds,
        )
        return summary

    # ------------------------------------------------------------- internals
    def _page_indices(self, page_count: int) -> Iterable[int]:
        start, end = 0, page_count
        if self.config.page_range:
            lo, hi = self.config.page_range
            start = max(0, lo - 1)
            end = min(page_count, hi)
        if self.config.max_pages:
            end = min(end, start + self.config.max_pages)
        return range(start, end)

    def _iter_embedded(self, doc, page):
        """Yield (PIL image, meta) for every embedded bitmap placed on the page."""
        from furniture_ml.pdf._pymupdf import fitz

        seen_xrefs: set[int] = set()
        for item in page.get_images(full=True):
            xref = int(item[0])
            if xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)
            if len(seen_xrefs) > self.config.max_images_per_page:
                break

            raw: bytes | None = None
            image: Image.Image | None = None
            try:
                info = doc.extract_image(xref)
                raw = info.get("image")
                image = Image.open(io.BytesIO(raw))
                image.load()
            except Exception:
                image = None

            if image is None:
                # Fallback: let PyMuPDF normalise exotic colourspaces (CMYK, JPX...)
                try:
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n - pix.alpha >= 4: # CMYK -> RGB
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    raw = pix.tobytes("png")
                    image = Image.open(io.BytesIO(raw))
                    image.load()
                except Exception as exc:
                    logger.debug("xref %s unreadable: %s", xref, exc)
                    continue

            try:
                rects = page.get_image_rects(xref)
            except Exception:
                rects = []
            bbox = list(rects[0]) if rects else None
            page_area = float(page.rect.width * page.rect.height) or 1.0
            area_ratio = (
                float(rects[0].get_area()) / page_area if rects else None
            )

            yield image, {
                "xref": xref,
                "bbox": bbox,
                "occurrence_index": len(rects),
                "page_area_ratio": area_ratio,
                "raw_size": len(raw) if raw else 0,
                "method": "embedded",
            }

    def _iter_regions(self, page):
        """Rasterise the page and segment out non-background rectangular regions."""
        import cv2

        from furniture_ml.pdf._pymupdf import fitz

        scale = self.config.dpi / 72.0
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        page_img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        arr = np.asarray(page_img)

        gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
        # Non-white mask, closed so that a photo becomes one solid blob.
        mask = (gray < 245).astype(np.uint8) * 255
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        page_area = float(pix.width * pix.height) or 1.0
        count = 0
        for contour in sorted(contours, key=cv2.contourArea, reverse=True):
            if count >= self.config.max_images_per_page:
                break
            x, y, w, h = cv2.boundingRect(contour)
            region_ratio = (w * h) / page_area
            if region_ratio < 0.01 or region_ratio > 0.97:
                continue
            crop = page_img.crop((x, y, x + w, y + h))
            bbox_pdf = [x / scale, y / scale, (x + w) / scale, (y + h) / scale]
            count += 1
            yield crop, {
                "xref": None,
                "bbox": bbox_pdf,
                "occurrence_index": 1,
                "page_area_ratio": region_ratio,
                "raw_size": w * h * 3,
                "method": "rendered_region",
            }

    def _collect(self, candidates, page, page_no, pdf_path, out_images,
        summary: ExtractionSummary, rejects: dict[str, int]) -> int:
        kept = 0
        for image, meta in candidates:
            report = assess(
                image,
                file_size=meta.get("raw_size", 0),
                page_area_ratio=meta.get("page_area_ratio"),
                config=self.config.filters,
            )
            if not report.keep:
                rejects[report.reason] = rejects.get(report.reason, 0) + 1
                continue

            record = self._save(image, meta, page, page_no, pdf_path, out_images, report.metrics)
            summary.images.append(record)
            kept += 1
        return kept

    def _save(self, image: Image.Image, meta: dict, page, page_no: int,
        pdf_path: Path, out_images: Path, metrics: dict) -> ExtractedImage:
        image_id = new_image_id()
        rgb = image.convert("RGB")
        if max(rgb.size) > self.config.max_side:
            rgb.thumbnail((self.config.max_side, self.config.max_side), Image.LANCZOS)

        fmt = self.config.save_format.upper()
        ext = ".jpg" if fmt in {"JPG", "JPEG"} else ".png"
        filename = f"{safe_stem(pdf_path.stem, 32)}_p{page_no:04d}_{image_id}{ext}"
        path = out_images / filename

        buffer = io.BytesIO()
        if ext == ".jpg":
            rgb.save(buffer, "JPEG", quality=self.config.jpeg_quality, optimize=True)
        else:
            rgb.save(buffer, "PNG", optimize=True)
        payload = buffer.getvalue()
        path.write_bytes(payload)

        text_snippet = ""
        hints: list[str] = []
        if self.config.capture_text_context:
            if meta.get("bbox"):
                # Caption-zone scan: picks up SKU text like
                # "D29-1607 办公桌 1600Wx750Dx750Hmm" printed under the photo.
                text_snippet = extract_nearby_text(
                    page, meta["bbox"], expand_y=90, expand_x=30
                ) or text_near_bbox(page, meta["bbox"])
                hints = keyword_hints(text_snippet)
            if not hints:
                # Fall back to whole-page text (e.g. a section heading at the top
                # of the page). Still only a review hint, never a label.
                page_text = clean_text(page.get_text("text"), 400)
                hints = keyword_hints(page_text)
                text_snippet = text_snippet or page_text

        return ExtractedImage(
            image_id=image_id,
            source_pdf=pdf_path.name,
            page_number=page_no,
            image_path=str(path),
            width=rgb.width,
            height=rgb.height,
            file_size_bytes=len(payload),
            image_format=fmt,
            extraction_method=meta.get("method", "embedded"),
            xref=meta.get("xref"),
            bbox=meta.get("bbox"),
            occurrence_index=meta.get("occurrence_index", 1),
            content_hash=sha256_bytes(rgb.tobytes()),
            quality=metrics,
            page_text_snippet=text_snippet,
            keyword_hints=hints,
        )
