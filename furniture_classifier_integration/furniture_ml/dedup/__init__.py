"""Exact and near-duplicate image detection."""

from furniture_ml.dedup.hashing import ImageHashes, compute_hashes, hamming
from furniture_ml.dedup.deduplicator import (
DedupConfig,
DedupResult,
ImageDeduplicator,
)

__all__ = [
"ImageHashes",
"compute_hashes",
"hamming",
"DedupConfig",
"DedupResult",
"ImageDeduplicator",
]
