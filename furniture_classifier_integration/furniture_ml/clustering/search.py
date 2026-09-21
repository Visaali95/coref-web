"""In-memory cosine similarity index for Alibaba-style visual search."""

from __future__ import annotations

import numpy as np


class SimilarityIndex:
    """Fits on L2-normalised embeddings; queries return (id, score)."""

    def __init__(self) -> None:
        self.ids: list[str] = []
        self.vectors: np.ndarray | None = None
        self._nn = None

    def __len__(self) -> int:
        return len(self.ids)

    def fit(self, vectors: np.ndarray, ids: list[str]) -> None:
        self.ids = list(ids)
        self.vectors = np.asarray(vectors, dtype=np.float32)
        self._nn = None
        if len(self.ids) >= 2:
            try:
                from sklearn.neighbors import NearestNeighbors

                n = min(len(self.ids), 100)
                self._nn = NearestNeighbors(n_neighbors=n, metric="cosine")
                self._nn.fit(self.vectors)
            except Exception:
                self._nn = None

    def query(
        self, vector: np.ndarray, top_k: int = 12, exclude_self: bool = True
    ) -> list[tuple[str, float]]:
        if self.vectors is None or not self.ids:
            return []
        vec = np.asarray(vector, dtype=np.float32).ravel()
        norm = float(np.linalg.norm(vec))
        if norm > 0:
            vec = vec / norm
        sims = (self.vectors @ vec).astype(float)
        order = np.argsort(-sims)
        results: list[tuple[str, float]] = []
        query_id = getattr(vector, "_query_id", None)
        for pos in order.tolist():
            candidate = self.ids[pos]
            if exclude_self and query_id is not None and candidate == query_id:
                continue
            results.append((candidate, float(sims[pos])))
            if len(results) >= top_k:
                break
        return results

    def query_by_id(
        self, image_id: str, top_k: int = 12
    ) -> list[tuple[str, float]]:
        if self.vectors is None or image_id not in self.ids:
            return []
        pos = self.ids.index(image_id)
        vec = self.vectors[pos]
        results = [
            (cid, score)
            for cid, score in self.query(vec, top_k=top_k + 1, exclude_self=False)
            if cid != image_id
        ]
        return results[:top_k]
