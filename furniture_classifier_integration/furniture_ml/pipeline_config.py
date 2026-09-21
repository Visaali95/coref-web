"""Loads ``config/pipeline.yaml`` into ExtractionConfig / FilterConfig / DedupConfig."""

from __future__ import annotations

from dataclasses import fields
from pathlib import Path

import yaml

from furniture_ml.config import PROJECT_ROOT
from furniture_ml.dedup.deduplicator import DedupConfig
from furniture_ml.pdf.extractor import ExtractionConfig
from furniture_ml.pdf.filters import FilterConfig
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)

DEFAULT_PIPELINE_CONFIG = PROJECT_ROOT / "config" / "pipeline.yaml"

def _apply(instance, data: dict | None):
    if not data:
        return instance
    known = {f.name for f in fields(instance)}
    for key, value in data.items():
        if key not in known:
            logger.warning("Ignoring unknown pipeline config key '%s'", key)
            continue
        current = getattr(instance, key)
        if isinstance(current, tuple) and isinstance(value, list):
            value = tuple(value)
        setattr(instance, key, value)
    return instance

def load_pipeline_config(path: str | Path | None = None) -> tuple[ExtractionConfig, DedupConfig]:
    config_path = Path(path) if path else DEFAULT_PIPELINE_CONFIG
    raw: dict = {}
    if config_path.exists():
        raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}

    extraction = _apply(ExtractionConfig(), raw.get("extraction"))
    extraction.filters = _apply(FilterConfig(), raw.get("filters"))
    if isinstance(extraction.page_range, list):
        extraction.page_range = tuple(extraction.page_range)
    dedup = _apply(DedupConfig(), raw.get("dedup"))
    return extraction, dedup
