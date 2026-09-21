"""Deduplicate extracted images.

Pipeline:
1. **Exact duplicates** - identical decoded pixel content (sha256).
2. **Near duplicates** - resized / recompressed / lightly edited copies detected
   with perceptual hashes (pHash + dHash + centre-crop pHash).
3. **Optional embedding pass** - cosine similarity over CNN features, which
   catches heavier crops and colour-graded variants that hashing misses.

The first image of each group is kept as the *representative*; all others are
flagged ``is_duplicate=True`` with a pointer to the representative, so nothing is
lost and the decision is fully auditable.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
from PIL import Image

from furniture_ml.dedup.hashing import compute_hashes
from furniture_ml.pdf.schemas import ExtractedImage
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)


@dataclass
class DedupConfig:
    hash_size: int = 8
    phash_threshold: int = 6  # <= is a near duplicate (out of 64 bits)
    dhash_threshold: int = 8
    crop_threshold: int = 6  # centre-crop pHash, catches cropped variants
    use_embeddings: bool = False
    embedding_model: str = "mobilenetv3_small_100"
    embedding_threshold: float = 0.94  # cosine similarity
    embedding_batch_size: int = 32


@dataclass
class DuplicateGroup:
    representative: str
    members: list[str] = field(default_factory=list)


@dataclass
class DedupResult:
    records: list[ExtractedImage]
    groups: list[DuplicateGroup] = field(default_factory=list)
    n_input: int = 0
    n_unique: int = 0
    n_exact_duplicates: int = 0
    n_near_duplicates: int = 0

    @property
    def unique_records(self) -> list[ExtractedImage]:
        return [r for r in self.records if not r.is_duplicate]

    def summary(self) -> dict:
        return {
            "input": self.n_input,
            "unique": self.n_unique,
            "exact_duplicates": self.n_exact_duplicates,
            "near_duplicates": self.n_near_duplicates,
            "duplicate_groups": len(self.groups),
        }


def _bits(hex_str: str) -> np.ndarray:
    return np.unpackbits(np.frombuffer(bytes.fromhex(hex_str), dtype=np.uint8))


class ImageDeduplicator:
    def __init__(self, config: DedupConfig | None = None) -> None:
        self.config = config or DedupConfig()

    # ------------------------------------------------------------------ API
    def deduplicate(self, records: Sequence[ExtractedImage]) -> DedupResult:
        records = list(records)
        result = DedupResult(records=records, n_input=len(records))
        if not records:
            return result

        self._ensure_hashes(records)

        groups: dict[str, DuplicateGroup] = {}
        by_content: dict[str, str] = {}
        keepers: list[ExtractedImage] = []
        keeper_phash: list[np.ndarray] = []
        keeper_dhash: list[np.ndarray] = []
        keeper_crop: list[np.ndarray] = []

        cfg = self.config
        for record in records:
            # 1) exact
            rep_id = by_content.get(record.content_hash)
            if rep_id is not None:
                self._mark(record, rep_id, "exact", 0, groups)
                result.n_exact_duplicates += 1
                continue

            # 2) near (vectorised hamming against all current keepers)
            match_idx, distance = self._nearest(
                record, keeper_phash, keeper_dhash, keeper_crop
            )
            if match_idx is not None:
                self._mark(record, keepers[match_idx].image_id, "near", distance, groups)
                result.n_near_duplicates += 1
                continue

            by_content[record.content_hash] = record.image_id
            keepers.append(record)
            keeper_phash.append(_bits(record.perceptual_hash))
            keeper_dhash.append(_bits(record.difference_hash))
            keeper_crop.append(_bits(record.quality.get("crop_phash", record.perceptual_hash)))

        # 3) optional embedding pass over the survivors
        if cfg.use_embeddings and len(keepers) > 1:
            extra = self._embedding_pass(keepers, groups)
            result.n_near_duplicates += extra

        result.groups = [g for g in groups.values() if g.members]
        result.n_unique = sum(1 for r in records if not r.is_duplicate)
        logger.info(
            "Dedup: %s in -> %s unique (%s exact, %s near)",
            result.n_input, result.n_unique,
            result.n_exact_duplicates, result.n_near_duplicates,
        )
        return result

    # ------------------------------------------------------------- internals
    def _ensure_hashes(self, records: Iterable[ExtractedImage]) -> None:
        for record in records:
            if record.perceptual_hash and record.difference_hash:
                continue
            try:
                hashes = compute_hashes(Path(record.image_path), self.config.hash_size)
            except Exception as exc:
                logger.warning("Hashing failed for %s: %s", record.image_path, exc)
                continue
            record.perceptual_hash = hashes.phash
            record.difference_hash = hashes.dhash
            record.quality["ahash"] = hashes.ahash
            record.quality["crop_phash"] = hashes.crop_phash
            if not record.content_hash:
                with Image.open(record.image_path) as img:
                    record.content_hash = hashlib.sha256(
                        img.convert("RGB").tobytes()
                    ).hexdigest()

    def _nearest(self, record, keeper_phash, keeper_dhash, keeper_crop):
        if not keeper_phash or not record.perceptual_hash:
            return None, None
        cfg = self.config
        p = _bits(record.perceptual_hash)
        d = _bits(record.difference_hash)
        c = _bits(record.quality.get("crop_phash", record.perceptual_hash))

        pd = np.count_nonzero(np.asarray(keeper_phash) != p, axis=1)
        dd = np.count_nonzero(np.asarray(keeper_dhash) != d, axis=1)
        cd = np.count_nonzero(np.asarray(keeper_crop) != c, axis=1)

        candidate = (
            ((pd <= cfg.phash_threshold) & (dd <= cfg.dhash_threshold))
            | (cd <= cfg.crop_threshold)
        )
        if not candidate.any():
            return None, None
        scores = np.where(candidate, pd + dd, 10_000)
        idx = int(np.argmin(scores))
        return idx, int(pd[idx])

    @staticmethod
    def _mark(record, rep_id, kind, distance, groups) -> None:
        record.is_duplicate = True
        record.duplicate_of = rep_id
        record.duplicate_kind = kind
        record.duplicate_distance = distance
        groups.setdefault(rep_id, DuplicateGroup(representative=rep_id)).members.append(
            record.image_id
        )

    def _embedding_pass(self, keepers: list[ExtractedImage], groups) -> int:
        """Catch heavy crops / recolours using CNN feature cosine similarity."""
        try:
            embeddings = self._embed([Path(k.image_path) for k in keepers])
        except Exception as exc:  # pragma: no cover - optional path
            logger.warning("Embedding dedup skipped: %s", exc)
            return 0

        similarity = embeddings @ embeddings.T
        np.fill_diagonal(similarity, -1.0)
        removed = 0
        for j in range(1, len(keepers)):
            if keepers[j].is_duplicate:
                continue
            alive = [i for i in range(j) if not keepers[i].is_duplicate]
            if not alive:
                continue
            sims = similarity[j, alive]
            best = int(np.argmax(sims))
            if float(sims[best]) >= self.config.embedding_threshold:
                self._mark(keepers[j], keepers[alive[best]].image_id, "near", None, groups)
                keepers[j].quality["embedding_similarity"] = round(float(sims[best]), 4)
                removed += 1
        return removed

    def _embed(self, paths: list[Path]) -> np.ndarray:
        import timm
        import torch

        from furniture_ml.utils.device import resolve_device

        device = resolve_device()
        model = timm.create_model(self.config.embedding_model, pretrained=True, num_classes=0)
        model.eval().to(device)
        cfg = timm.data.resolve_data_config({}, model=model)
        transform = timm.data.create_transform(**cfg, is_training=False)

        vectors: list[np.ndarray] = []
        with torch.no_grad():
            for start in range(0, len(paths), self.config.embedding_batch_size):
                batch_paths = paths[start : start + self.config.embedding_batch_size]
                tensors = []
                for p in batch_paths:
                    with Image.open(p) as img:
                        tensors.append(transform(img.convert("RGB")))
                batch = torch.stack(tensors).to(device)
                feats = model(batch).float().cpu().numpy()
                vectors.append(feats)

        matrix = np.concatenate(vectors, axis=0)
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        return matrix / np.clip(norms, 1e-8, None)
