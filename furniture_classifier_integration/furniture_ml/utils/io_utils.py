"""Filesystem / serialisation helpers."""

from __future__ import annotations

import csv
import hashlib
import json
import uuid
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence

from furniture_ml.constants import SUPPORTED_IMAGE_EXTENSIONS


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def new_image_id(prefix: str = "img") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        while block := fh.read(chunk):
            h.update(block)
    return h.hexdigest()


def safe_stem(name: str, max_len: int = 60) -> str:
    keep = "".join(c if (c.isalnum() or c in "-_") else "_" for c in name)
    return keep[:max_len].strip("_") or "file"


def iter_images(root: Path, recursive: bool = True) -> list[Path]:
    if not root.exists():
        return []
    globber = root.rglob("*") if recursive else root.glob("*")
    return sorted(
        p for p in globber if p.is_file() and p.suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS
    )


def _jsonable(obj: Any) -> Any:
    if is_dataclass(obj) and not isinstance(obj, type):
        return {k: _jsonable(v) for k, v in asdict(obj).items()}
    if isinstance(obj, Path):
        return str(obj)
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_jsonable(v) for v in obj]
    return obj


def write_json(path: Path, data: Any, indent: int = 2) -> Path:
    ensure_dir(path.parent)
    path.write_text(json.dumps(_jsonable(data), indent=indent), encoding="utf-8")
    return path


def read_json(path: Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_csv(path: Path, rows: Iterable[Any], fieldnames: Sequence[str] | None = None) -> Path:
    rows = [_jsonable(r) for r in rows]
    if not rows:
        ensure_dir(path.parent)
        path.write_text("", encoding="utf-8")
        return path
    fieldnames = list(fieldnames or rows[0].keys())
    ensure_dir(path.parent)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    return path


def read_csv(path: Path) -> list[dict[str, str]]:
    p = Path(path)
    if not p.exists() or not p.read_text(encoding="utf-8").strip():
        return []
    with p.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))
