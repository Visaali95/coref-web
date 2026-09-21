"""Service layer: embeddings cache + clustering + search over the curation DB."""

from __future__ import annotations

import threading
from pathlib import Path

import numpy as np

from furniture_ml.clustering.cluster import (
    cluster_embeddings,
    merge_same_page_views,
)
from furniture_ml.clustering.embeddings import BackboneEmbedder
from furniture_ml.clustering.search import SimilarityIndex
from furniture_ml.config import Settings, get_settings
from furniture_ml.curation.store import CurationStore, get_store
from furniture_ml.utils.io_utils import ensure_dir
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)


class CurationService:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.store: CurationStore = get_store()
        self._embedder: BackboneEmbedder | None = None
        self._index = SimilarityIndex()
        self._index_ids: list[str] = []
        self._lock = threading.Lock()

    # ------------------------------------------------------------- embeddings
    @property
    def cache_path(self) -> Path:
        return ensure_dir(self.settings.artifacts_dir) / "embeddings.npz"

    def _embedder_lazy(self) -> BackboneEmbedder:
        if self._embedder is None:
            self._embedder = BackboneEmbedder(settings=self.settings)
        return self._embedder

    def rebuild_embeddings(self) -> dict:
        """Embed every product image that exists on disk; cache to .npz."""
        products = self.store.list_products(limit=100_000)
        paths: list[str] = []
        ids: list[str] = []
        for p in products:
            fp = p.get("image_path")
            if fp and Path(fp).exists():
                ids.append(p["image_id"])
                paths.append(fp)
        if not ids:
            return {"embedded": 0, "dim": 0, "backend": "none"}
        embedder = self._embedder_lazy()
        vectors = embedder.embed_many(paths)
        np.savez_compressed(
            self.cache_path, ids=np.array(ids), vectors=vectors,
            backend=np.array([embedder.backend]),
        )
        with self._lock:
            self._index.fit(vectors, ids)
            self._index_ids = ids
        return {"embedded": len(ids), "dim": int(vectors.shape[1]),
                "backend": embedder.backend}

    def _ensure_index(self) -> SimilarityIndex:
        with self._lock:
            if self._index_ids:
                return self._index
        if self.cache_path.exists():
            try:
                data = np.load(str(self.cache_path), allow_pickle=True)
                ids = data["ids"].tolist()
                vectors = np.asarray(data["vectors"], dtype=np.float32)
                with self._lock:
                    self._index.fit(vectors, ids)
                    self._index_ids = ids
                return self._index
            except Exception as exc:
                logger.warning("Could not load embedding cache: %s", exc)
        self.rebuild_embeddings()
        return self._index

    def _page_view_metadata(self) -> dict[str, dict]:
        """Map image_id -> {source_pdf, page_number, snippet} for the page pass.

        Provenance comes from the curation DB; caption/OCR snippets come from
        ``data/manifest.csv`` (same machine, same layout as the admin UI uses).
        Missing manifest/snippet simply means no page-merge for that image.
        """
        products = self.store.list_products(limit=100_000)
        snippets: dict[str, str] = {}
        manifest = self.settings.data_dir / "manifest.csv"
        if manifest.exists():
            try:
                import csv

                with manifest.open(encoding="utf-8", newline="") as f:
                    for row in csv.DictReader(f):
                        snippets[row.get("image_id", "")] = (
                            row.get("page_text_snippet", "") or ""
                        )[:400]
            except Exception as exc:
                logger.warning("Could not read manifest snippets: %s", exc)
        return {
            p["image_id"]: {
                "source_pdf": p.get("source_pdf"),
                "page_number": p.get("page_number"),
                "snippet": snippets.get(p["image_id"], ""),
            }
            for p in products
        }

    # ------------------------------------------------------------- clustering
    def run_clustering(
        self, *, threshold: float = 0.92, method: str = "agglomerative",
        page_merge: bool = True,
    ) -> dict:
        info = self.rebuild_embeddings()
        if info["embedded"] == 0:
            result = {"method": method, "threshold": threshold, "num_clusters": 0,
                      "clusters": []}
            self.store.set_clusters([])
            return result
        data = np.load(str(self.cache_path), allow_pickle=True)
        ids = data["ids"].tolist()
        vectors = np.asarray(data["vectors"], dtype=np.float32)
        clustered = cluster_embeddings(vectors, ids, threshold=threshold, method=method)
        if page_merge:
            # Same-product multi-view pass: union clusters whose members share
            # one PDF page and one SKU family (e.g. room + front/rear views of
            # B921-2016 that visual embeddings keep apart).
            clustered = merge_same_page_views(
                clustered, self._page_view_metadata()
            )
            if clustered.page_merges:
                logger.info("Page-level SKU pass merged %d clusters", clustered.page_merges)
        payload = clustered.to_dict()
        self.store.set_clusters(payload["clusters"])
        return payload

    # ------------------------------------------------------------- search
    def search_by_id(self, image_id: str, top_k: int = 12) -> list[dict]:
        index = self._ensure_index()
        hits = index.query_by_id(image_id, top_k=top_k)
        return [self._hit(h) for h in hits]

    def search_by_image(self, image_path: str | Path, top_k: int = 12) -> list[dict]:
        index = self._ensure_index()
        vec = self._embedder_lazy().embed_image(image_path)
        hits = index.query(vec, top_k=top_k)
        return [self._hit(h) for h in hits]

    def _hit(self, hit: tuple[str, float]) -> dict:
        image_id, score = hit
        product = self.store.get_product(image_id) or {}
        return {
            "image_id": image_id,
            "score": round(float(score), 4),
            "category": product.get("category"),
            "status": product.get("status"),
            "cluster_id": product.get("cluster_id"),
            "image_path": product.get("image_path"),
            "page_number": product.get("page_number"),
        }


_service: CurationService | None = None
_service_lock = threading.Lock()


def get_service() -> CurationService:
    global _service
    with _service_lock:
        if _service is None:
            _service = CurationService()
        return _service
