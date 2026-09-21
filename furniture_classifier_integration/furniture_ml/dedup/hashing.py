"""Perceptual hashing primitives.

pHash (DCT based) -> robust to resize / compression / mild colour shifts
dHash (gradient) -> robust to brightness changes
aHash (average) -> cheap sanity signal
Centre-crop pHash -> robust to images that were cropped / had borders added
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


@dataclass(frozen=True)
class ImageHashes:
    phash: str
    dhash: str
    ahash: str
    crop_phash: str

    def bits(self) -> np.ndarray:
        return _hex_to_bits(self.phash)


def _hash_to_hex(bits: np.ndarray) -> str:
    packed = np.packbits(bits.astype(np.uint8).ravel())
    return packed.tobytes().hex()


def _hex_to_bits(hex_str: str) -> np.ndarray:
    raw = bytes.fromhex(hex_str)
    return np.unpackbits(np.frombuffer(raw, dtype=np.uint8))


def hamming(a: str, b: str) -> int:
    """Hamming distance between two hex-encoded hashes."""
    if len(a) != len(b):
        raise ValueError("Hash length mismatch")
    return int(np.count_nonzero(_hex_to_bits(a) != _hex_to_bits(b)))


def _dct_1d(matrix: np.ndarray) -> np.ndarray:
    """Type-II DCT along the last axis (no SciPy dependency)."""
    n = matrix.shape[-1]
    k = np.arange(n)
    basis = np.cos(np.pi * (2 * k[None, :] + 1) * k[:, None] / (2 * n))
    return matrix @ basis.T


def perceptual_hash(image: Image.Image, hash_size: int = 8, highfreq_factor: int = 4) -> str:
    size = hash_size * highfreq_factor
    gray = image.convert("L").resize((size, size), Image.LANCZOS)
    arr = np.asarray(gray, dtype=np.float64)
    dct = _dct_1d(_dct_1d(arr).T).T
    low = dct[:hash_size, :hash_size]
    med = np.median(low[1:, 1:])  # skip DC term
    return _hash_to_hex(low > med)


def difference_hash(image: Image.Image, hash_size: int = 8) -> str:
    gray = image.convert("L").resize((hash_size + 1, hash_size), Image.LANCZOS)
    arr = np.asarray(gray, dtype=np.int16)
    return _hash_to_hex(arr[:, 1:] > arr[:, :-1])


def average_hash(image: Image.Image, hash_size: int = 8) -> str:
    gray = image.convert("L").resize((hash_size, hash_size), Image.LANCZOS)
    arr = np.asarray(gray, dtype=np.float64)
    return _hash_to_hex(arr > arr.mean())


def _centre_crop(image: Image.Image, ratio: float = 0.8) -> Image.Image:
    w, h = image.size
    cw, ch = int(w * ratio), int(h * ratio)
    left, top = (w - cw) // 2, (h - ch) // 2
    return image.crop((left, top, left + cw, top + ch))


def compute_hashes(image: str | Path | Image.Image, hash_size: int = 8) -> ImageHashes:
    if isinstance(image, (str, Path)):
        with Image.open(image) as opened:
            opened.load()
            img = opened.convert("RGB")
    else:
        img = image.convert("RGB")

    return ImageHashes(
        phash=perceptual_hash(img, hash_size),
        dhash=difference_hash(img, hash_size),
        ahash=average_hash(img, hash_size),
        crop_phash=perceptual_hash(_centre_crop(img), hash_size),
    )
