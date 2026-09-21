"""Heuristic relevance filter: keep product photos, drop logos/icons/rules/backgrounds.

Every rule is configurable and every rejection returns a machine-readable reason so
the extraction report tells you *why* an image was dropped.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from PIL import Image

@dataclass
class FilterConfig:
    min_width: int = 120
    min_height: int = 120
    min_area: int = 120 * 120
    max_aspect_ratio: float = 5.0 # rejects rules, banners, separators
    min_file_size_bytes: int = 3_000
    min_std: float = 8.0 # rejects flat colour blocks / backgrounds
    max_uniform_ratio: float = 0.92 # single dominant colour share
    min_edge_density: float = 0.010 # rejects blank/near-blank regions
    max_edge_density: float = 0.75 # rejects dense text blocks / screenshots
    min_unique_colors: int = 24 # rejects 2-3 colour icons & line art logos
    max_page_area_ratio: float = 0.96 # rejects full-page backgrounds
    max_alpha_transparent_ratio: float = 0.85

@dataclass
class QualityReport:
    keep: bool
    reason: str
    metrics: dict

def _edge_density(gray: np.ndarray) -> float:
    """Sobel-based edge density (no OpenCV dependency required)."""
    g = gray.astype(np.float32)
    gx = np.abs(np.diff(g, axis=1))
    gy = np.abs(np.diff(g, axis=0))
    edges = np.concatenate([gx.ravel(), gy.ravel()])
    if edges.size == 0:
        return 0.0
    return float((edges > 20).mean())

def assess(image: Image.Image, *, file_size: int, page_area_ratio: float | None,
    config: FilterConfig | None = None) -> QualityReport:
    """Decide whether an extracted bitmap is plausibly a product image."""
    cfg = config or FilterConfig()
    w, h = image.size
    metrics: dict = {"width": w, "height": h, "file_size": file_size}

    if w < cfg.min_width or h < cfg.min_height:
        return QualityReport(False, "too_small", metrics)
    if w * h < cfg.min_area:
        return QualityReport(False, "area_too_small", metrics)

    ar = max(w / h, h / w)
    metrics["aspect_ratio"] = round(ar, 3)
    if ar > cfg.max_aspect_ratio:
        return QualityReport(False, "extreme_aspect_ratio", metrics)

    if file_size < cfg.min_file_size_bytes:
        return QualityReport(False, "file_too_small", metrics)

    if page_area_ratio is not None:
        metrics["page_area_ratio"] = round(page_area_ratio, 3)
        if page_area_ratio > cfg.max_page_area_ratio:
            return QualityReport(False, "full_page_background", metrics)

    # Transparency check - logos are usually mostly transparent PNGs.
    if image.mode in ("RGBA", "LA"):
        alpha = np.asarray(image.getchannel("A"))
        transparent_ratio = float((alpha < 16).mean())
        metrics["transparent_ratio"] = round(transparent_ratio, 3)
        if transparent_ratio > cfg.max_alpha_transparent_ratio:
            return QualityReport(False, "mostly_transparent", metrics)

    rgb = image.convert("RGB")
    # Work on a thumbnail: the statistics are scale-invariant enough and it is fast.
    thumb = rgb.copy()
    thumb.thumbnail((256, 256))
    arr = np.asarray(thumb)

    std = float(arr.std())
    metrics["std"] = round(std, 3)
    if std < cfg.min_std:
        return QualityReport(False, "flat_color_block", metrics)

    quantised = (arr // 16).reshape(-1, 3)
    colors, counts = np.unique(quantised, axis=0, return_counts=True)
    unique_colors = int(len(colors))
    uniform_ratio = float(counts.max() / counts.sum())
    metrics["unique_colors"] = unique_colors
    metrics["uniform_ratio"] = round(uniform_ratio, 3)
    if unique_colors < cfg.min_unique_colors:
        return QualityReport(False, "too_few_colors", metrics)
    if uniform_ratio > cfg.max_uniform_ratio:
        return QualityReport(False, "dominant_single_color", metrics)

    gray = np.asarray(thumb.convert("L"))
    density = _edge_density(gray)
    metrics["edge_density"] = round(density, 4)
    if density < cfg.min_edge_density:
        return QualityReport(False, "no_structure", metrics)
    if density > cfg.max_edge_density:
        return QualityReport(False, "text_like_noise", metrics)

    return QualityReport(True, "ok", metrics)
