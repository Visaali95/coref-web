"""SQLite curation store: products + clusters. Stdlib ``sqlite3`` only."""

from __future__ import annotations

import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

from furniture_ml.config import Settings, get_settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
  image_id TEXT PRIMARY KEY,
  image_path TEXT,
  source_pdf TEXT,
  page_number INTEGER,
  category TEXT,
  confidence REAL,
  status TEXT,
  raw_category TEXT,
  cluster_id TEXT,
  is_custom INTEGER DEFAULT 0,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS clusters (
  cluster_id TEXT PRIMARY KEY,
  representative_id TEXT,
  size INTEGER DEFAULT 0,
  updated_at TEXT
);
"""


class CurationStore:
    def __init__(self, path: str | Path | None = None, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.path = Path(path) if path else self.settings.data_dir / "curation.db"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self) -> None:
        with self._lock, self._connect() as conn:
            conn.executescript(_SCHEMA)

    # ------------------------------------------------------------- products
    def upsert_products(self, rows: list[dict[str, Any]]) -> int:
        now = time.strftime("%Y-%m-%dT%H:%M:%S")
        count = 0
        with self._lock, self._connect() as conn:
            for r in rows:
                conn.execute(
                    """INSERT INTO products
                    (image_id,image_path,source_pdf,page_number,category,confidence,
                     status,raw_category,cluster_id,is_custom,updated_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)
                    ON CONFLICT(image_id) DO UPDATE SET
                      image_path=excluded.image_path, source_pdf=excluded.source_pdf,
                      page_number=excluded.page_number, category=excluded.category,
                      confidence=excluded.confidence, status=excluded.status,
                      raw_category=excluded.raw_category,
                      cluster_id=COALESCE(products.cluster_id, excluded.cluster_id),
                      updated_at=excluded.updated_at""",
                    (
                        r.get("image_id"),
                        r.get("image_path"),
                        r.get("source_pdf"),
                        r.get("page_number"),
                        r.get("category"),
                        r.get("confidence", 0.0),
                        r.get("status", "needs_review"),
                        r.get("raw_category"),
                        r.get("cluster_id"),
                        int(bool(r.get("is_custom", False))),
                        now,
                    ),
                )
                count += 1
        return count

    def list_products(
        self,
        *,
        status: str | None = None,
        category: str | None = None,
        cluster_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        query = "SELECT * FROM products WHERE 1=1"
        params: list[Any] = []
        if status:
            query += " AND status=?"
            params.append(status)
        if category:
            query += " AND category=?"
            params.append(category)
        if cluster_id:
            query += " AND cluster_id=?"
            params.append(cluster_id)
        query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        params += [limit, offset]
        with self._connect() as conn:
            return [dict(r) for r in conn.execute(query, params).fetchall()]

    def count_products(self, status: str | None = None) -> int:
        query = "SELECT COUNT(*) FROM products" + (" WHERE status=?" if status else "")
        with self._connect() as conn:
            row = conn.execute(query, ([status] if status else [])).fetchone()
            return int(row[0])

    def get_product(self, image_id: str) -> dict | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM products WHERE image_id=?", (image_id,)
            ).fetchone()
            return dict(row) if row else None

    def update_product(
        self,
        image_id: str,
        *,
        category: str | None = None,
        status: str | None = None,
        cluster_id: str | None = None,
    ) -> dict | None:
        fields: dict[str, Any] = {}
        if category is not None:
            fields["category"] = category
        if status is not None:
            fields["status"] = status
        if cluster_id is not None:
            fields["cluster_id"] = cluster_id
        if not fields:
            return self.get_product(image_id)
        fields["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        with self._lock, self._connect() as conn:
            conn.execute(
                f"UPDATE products SET {', '.join(f'{k}=?' for k in fields)} "
                "WHERE image_id=?",
                (*fields.values(), image_id),
            )
        return self.get_product(image_id)

    def delete_product(self, image_id: str) -> bool:
        with self._lock, self._connect() as conn:
            cur = conn.execute("DELETE FROM products WHERE image_id=?", (image_id,))
            return cur.rowcount > 0

    def create_custom_product(
        self, image_path: str, category: str, cluster_id: str | None = None
    ) -> dict:
        image_id = f"custom_{int(time.time()*1000)}"
        self.upsert_products(
            [
                {
                    "image_id": image_id,
                    "image_path": image_path,
                    "source_pdf": "custom",
                    "page_number": None,
                    "category": category,
                    "confidence": 1.0,
                    "status": "classified",
                    "raw_category": category,
                    "cluster_id": cluster_id,
                    "is_custom": True,
                }
            ]
        )
        return self.get_product(image_id)  # type: ignore[return-value]

    # ------------------------------------------------------------- clusters
    def set_clusters(self, clusters: list[dict]) -> None:
        """Replace cluster table and assign member cluster_ids."""
        now = time.strftime("%Y-%m-%dT%H:%M:%S")
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM clusters")
            for c in clusters:
                conn.execute(
                    "INSERT INTO clusters (cluster_id, representative_id, size, updated_at)"
                    " VALUES (?,?,?,?)",
                    (c["cluster_id"], c.get("representative_id"), len(c.get("member_ids", [])) or c.get("size", 0), now),
                )
                for member in c.get("member_ids", []):
                    conn.execute(
                        "UPDATE products SET cluster_id=?, updated_at=? WHERE image_id=?",
                        (c["cluster_id"], now, member),
                    )

    def list_clusters(self) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM clusters ORDER BY size DESC").fetchall()
            out = []
            for r in rows:
                members = [
                    m["image_id"]
                    for m in conn.execute(
                        "SELECT image_id FROM products WHERE cluster_id=?",
                        (r["cluster_id"],),
                    ).fetchall()
                ]
                out.append(
                    {
                        "cluster_id": r["cluster_id"],
                        "representative_id": r["representative_id"],
                        "size": len(members),
                        "member_ids": members,
                    }
                )
            return out

    def merge_clusters(self, source_ids: list[str], target_id: str | None = None) -> dict:
        clusters = {c["cluster_id"]: c for c in self.list_clusters()}
        missing = [c for c in source_ids if c not in clusters]
        if missing:
            raise ValueError(f"Unknown clusters: {missing}")
        members: list[str] = []
        for cid in source_ids:
            members.extend(clusters[cid]["member_ids"])
        members = list(dict.fromkeys(members))
        new_id = target_id or source_ids[0]
        now = time.strftime("%Y-%m-%dT%H:%M:%S")
        with self._lock, self._connect() as conn:
            for cid in source_ids:
                if cid != new_id:
                    conn.execute("DELETE FROM clusters WHERE cluster_id=?", (cid,))
            conn.execute(
                "INSERT INTO clusters (cluster_id, representative_id, size, updated_at)"
                " VALUES (?,?,?,?) ON CONFLICT(cluster_id) DO UPDATE SET"
                " representative_id=excluded.representative_id, size=excluded.size,"
                " updated_at=excluded.updated_at",
                (new_id, members[0] if members else None, len(members), now),
            )
            for m in members:
                conn.execute(
                    "UPDATE products SET cluster_id=?, updated_at=? WHERE image_id=?",
                    (new_id, now, m),
                )
        updated = [c for c in self.list_clusters() if c["cluster_id"] == new_id]
        return updated[0] if updated else {"cluster_id": new_id, "member_ids": members}

    def split_cluster(self, cluster_id: str, groups: list[list[str]]) -> list[dict]:
        current = next(
            (c for c in self.list_clusters() if c["cluster_id"] == cluster_id), None
        )
        if current is None:
            raise ValueError(f"Unknown cluster: {cluster_id}")
        flat = [m for g in groups for m in g]
        if set(flat) != set(current["member_ids"]):
            raise ValueError("Split groups must partition the cluster exactly")
        now = time.strftime("%Y-%m-%dT%H:%M:%S")
        created = []
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM clusters WHERE cluster_id=?", (cluster_id,))
            for i, group in enumerate(groups, start=1):
                new_id = cluster_id if len(groups) == 1 else f"{cluster_id}_s{i}"
                conn.execute(
                    "INSERT INTO clusters (cluster_id, representative_id, size, updated_at)"
                    " VALUES (?,?,?,?)",
                    (new_id, group[0] if group else None, len(group), now),
                )
                for m in group:
                    conn.execute(
                        "UPDATE products SET cluster_id=?, updated_at=? WHERE image_id=?",
                        (new_id, now, m),
                    )
                created.append(
                    {"cluster_id": new_id, "representative_id": group[0] if group else None,
                     "size": len(group), "member_ids": group}
                )
        return created


_store: CurationStore | None = None
_store_lock = threading.Lock()


def get_store(path: str | Path | None = None) -> CurationStore:
    global _store
    from furniture_ml.config import get_settings as _get_settings

    with _store_lock:
        if path is not None:
            _store = CurationStore(path)
            return _store
        default = _get_settings().data_dir / "curation.db"
        if _store is None or Path(_store.path) != Path(default):
            _store = CurationStore(default)
        return _store


def reset_store() -> None:
    global _store
    with _store_lock:
        _store = None
