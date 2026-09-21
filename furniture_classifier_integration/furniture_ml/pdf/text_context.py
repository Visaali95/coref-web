"""Page-text context.

IMPORTANT: text near an image is captured as *metadata only*. It produces
``keyword_hints`` that are shown to the human labeller to speed up review - it is
never used to silently assign a training label, because catalogue layouts are not
a reliable label source.
"""

from __future__ import annotations

import re

from furniture_ml.constants import CATEGORIES

# Non-authoritative lexicon used purely to pre-sort the labelling queue.
# Expanded with Chinese + English catalog terminology so nearby SKU text
# (e.g. "D29-1607 办公桌 1600Wx750Dx750Hmm") can suggest a category.
KEYWORD_LEXICON: dict[str, tuple[str, ...]] = {
    "Office Furniture": (
        "办公", "办公桌", "班台", "大班台", "会议桌", "职员桌", "工作位",
        "屏风", "文件柜", "大班椅", "职员椅", "主管桌", "书柜", "洽谈桌",
        "office", "desk", "workstation", "executive", "conference",
        "office desk", "executive desk", "conference table",
        "office chair", "cubicle",
        "filing", "cabinet", "workplace", "ergonomic",
    ),
    "Villa Furniture": (
        "别墅", "沙发", "茶几", "电视柜", "餐桌", "餐椅", "床", "床头柜",
        "衣柜", "休闲椅", "酒柜", "软床",
        "villa", "sofa", "couch", "dining",
        "lounge", "dining table", "bed", "wardrobe",
        "bedroom", "coffee table", "living room", "armchair",
    ),
    "Chandelier": (
        "吊灯", "水晶灯", "客餐厅灯", "吸顶灯", "吊线灯", "台灯", "壁灯",
        "chandelier", "pendant", "lamp",
        "pendant lamp", "ceiling light",
        "crystal", "lustre", "luster", "chandeliers",
    ),
}

_WS = re.compile(r"\s+")

def clean_text(text: str, max_len: int = 400) -> str:
    return _WS.sub(" ", (text or "")).strip()[:max_len]

def _category_scores(text: str) -> dict[str, int]:
    """Count lexicon hits per category (CJK substring + case-insensitive latin)."""
    if not text:
        return {}
    lowered = f" {text.lower()} "
    scores: dict[str, int] = {}
    for category in CATEGORIES:
        hits = 0
        for kw in KEYWORD_LEXICON.get(category, ()):
            if any(ord(c) > 127 for c in kw):
                hits += text.count(kw)  # CJK: exact substring on raw text
            else:
                hits += lowered.count(kw.lower())
        if hits:
            scores[category] = hits
    return scores


def classify_text_snippet(text: str) -> tuple[str | None, float]:
    """Match a text snippet against the lexicon.

    Returns ``(category, 0.95)`` on a definitive keyword match, else
    ``(None, 0.0)``. Highest hit-count wins; ties resolve in
    canonical ``CATEGORIES`` order for determinism.
    """
    scores = _category_scores(text or "")
    if not scores:
        return None, 0.0
    best = max(CATEGORIES, key=lambda c: (scores.get(c, 0), -CATEGORIES.index(c)))
    if scores.get(best, 0) <= 0:
        return None, 0.0
    return best, 0.95


def keyword_hints(text: str, top_k: int = 2) -> list[str]:
    """Return candidate categories suggested by the surrounding text (advisory)."""
    scores = _category_scores(text or "")
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    return [c for c, _ in ranked[:top_k]]

_OCR_ENGINE = None


def _get_ocr_engine():
    """Singleton RapidOCR engine (Chinese+English). Returns None if unavailable."""
    global _OCR_ENGINE
    if _OCR_ENGINE is not None:
        return _OCR_ENGINE
    try:
        from rapidocr_onnxruntime import RapidOCR

        _OCR_ENGINE = RapidOCR()
        return _OCR_ENGINE
    except Exception:
        _OCR_ENGINE = False
        return None


def _ocr_window(page, window, max_len: int = 400) -> str:
    """OCR fallback for scanned catalogues with no embedded text layer."""
    try:
        from furniture_ml.pdf._pymupdf import fitz

        engine = _get_ocr_engine()
        if not engine:
            return ""
        import numpy as np
        from PIL import Image as _PILImage

        clip = window & page.rect
        if clip.is_empty or clip.width < 5 or clip.height < 5:
            return ""
        pix = page.get_pixmap(clip=clip, matrix=fitz.Matrix(2.5, 2.5), alpha=False)
        img = _PILImage.frombytes("RGB", (pix.width, pix.height), pix.samples)
        result, _ = engine(np.asarray(img))
        if not result:
            return ""
        texts = []
        for item in result:
            try:
                txt = item[1] if len(item) > 1 else ""
                conf = float(item[2]) if len(item) > 2 else 1.0
                if txt and conf >= 0.3:
                    texts.append(str(txt).strip())
            except Exception:
                continue
        return clean_text(" ".join(texts), max_len)
    except Exception:
        return ""


def extract_nearby_text(
    page, rect, expand_y: float = 90, expand_x: float = 30, max_len: int = 400
) -> str:
    """Scan text blocks/words within ``expand_y`` below and ``expand_x`` around ``bbox``.

    ``rect`` is ``[x0, y0, x1, y1]`` in PDF points. The window covers a
    small strip above the image plus the caption zone below where catalogues
    print SKU names / dimensions (e.g. "D29-1607 办公桌 ...").
    Falls back to OCR when the page carries no embedded text layer
    (scanned catalogues).
    """
    try:
        from furniture_ml.pdf._pymupdf import fitz

        # Backwards compat: callers may pass (page, image_bbox, ...).
        x0, y0, x1, y1 = (float(v) for v in rect)
        window = fitz.Rect(x0 - expand_x, y0 - 20, x1 + expand_x, y1 + expand_y) & page.rect
        text = clean_text(page.get_text("text", clip=window), max_len)
        if len(text.strip()) >= 2:
            return text
        return _ocr_window(page, window, max_len) or text
    except Exception:  # pragma: no cover - defensive
        return ""


def text_near_bbox(page, bbox, margin: float = 90.0, max_len: int = 400) -> str:
    """Extract the text inside a rectangle expanded around ``bbox``."""
    try:
        from furniture_ml.pdf._pymupdf import fitz

        rect = fitz.Rect(bbox)
        expanded = fitz.Rect(
            rect.x0 - margin, rect.y0 - margin, rect.x1 + margin, rect.y1 + margin
        ) & page.rect
        text = clean_text(page.get_text("text", clip=expanded), max_len)
        if len(text.strip()) >= 2:
            return text
        return _ocr_window(page, expanded, max_len) or text
    except Exception: # pragma: no cover - defensive
        return ""
