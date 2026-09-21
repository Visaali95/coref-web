"""Cosine-based clustering of product embeddings (Alibaba-style grouping).

Free/local: ``scikit-learn`` Agglomerative (default, deterministic) or DBSCAN.
Threshold is a cosine similarity in [0, 1]; higher = stricter grouping.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass
class ClusterItem:
    cluster_id: str
    member_ids: list[str]
    representative_id: str
    size: int


@dataclass
class ClusterResult:
    clusters: list[ClusterItem] = field(default_factory=list)
    method: str = "agglomerative"
    threshold: float = 0.92
    embedding_dim: int = 0
    page_merges: int = 0 # clusters absorbed by the same-page/SKU post-pass

    def to_dict(self) -> dict:
        return {
            "method": self.method,
            "threshold": self.threshold,
            "embedding_dim": self.embedding_dim,
            "num_clusters": len(self.clusters),
            "page_merges": self.page_merges,
            "clusters": [
                {
                    "cluster_id": c.cluster_id,
                    "member_ids": c.member_ids,
                    "representative_id": c.representative_id,
                    "size": c.size,
                }
                for c in self.clusters
            ],
        }

    def id_to_cluster(self) -> dict[str, str]:
        mapping: dict[str, str] = {}
        for c in self.clusters:
            for member in c.member_ids:
                mapping[member] = c.cluster_id
        return mapping


def _medoid(members: list[str], vectors: np.ndarray, idx: list[int]) -> str:
    sub = vectors[np.array(idx)]
    # Cosine similarity == dot for L2-normalised vectors.
    sims = sub @ sub.T
    scores = sims.sum(axis=1)
    return members[int(np.argmax(scores))]


def cluster_embeddings(
    embeddings: np.ndarray,
    ids: list[str],
    *,
    threshold: float = 0.92,
    method: str = "agglomerative",
    min_cluster_size: int = 1,
) -> ClusterResult:
    if len(ids) == 0:
        return ClusterResult(method=method, threshold=threshold)
    if len(ids) == 1:
        return ClusterResult(
            clusters=[
                ClusterItem("clu_0001", [ids[0]], ids[0], 1),
            ],
            method=method,
            threshold=threshold,
            embedding_dim=int(embeddings.shape[1]) if embeddings.size else 0,
        )
    distance = max(0.0, 1.0 - float(threshold))
    labels: np.ndarray
    if method == "dbscan":
        from sklearn.cluster import DBSCAN

        labels = DBSCAN(eps=distance, min_samples=2, metric="cosine").fit_predict(
            embeddings
        )
    else:  # agglomerative
        from sklearn.cluster import AgglomerativeClustering

        labels = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=distance,
            metric="cosine",
            linkage="average",
        ).fit_predict(embeddings)

    groups: dict[int, list[int]] = {}
    for pos, label in enumerate(labels.tolist()):
        groups.setdefault(int(label), []).append(pos)

    clusters: list[ClusterItem] = []
    counter = 0
    # DBSCAN noise (-1) -> each item its own singleton cluster.
    for label in sorted(groups, key=lambda l: (l == -1, l)):
        members_idx = groups[label]
        if label == -1:
            for pos in members_idx:
                counter += 1
                clusters.append(
                    ClusterItem(f"clu_{counter:04d}", [ids[pos]], ids[pos], 1)
                )
            continue
        if len(members_idx) < max(1, min_cluster_size):
            for pos in members_idx:
                counter += 1
                clusters.append(
                    ClusterItem(f"clu_{counter:04d}", [ids[pos]], ids[pos], 1)
                )
            continue
        counter += 1
        members = [ids[p] for p in members_idx]
        rep = _medoid(members, embeddings, members_idx)
        clusters.append(ClusterItem(f"clu_{counter:04d}", members, rep, len(members)))
    # Deterministic order: largest first.
    clusters.sort(key=lambda c: (-c.size, c.cluster_id))
    return ClusterResult(
        clusters=clusters,
        method=method,
        threshold=threshold,
        embedding_dim=int(embeddings.shape[1]),
    )


# ------------------------------------------------- same-product multi-view pass
# Catalogues print several photos of one SKU collection on a single page
# (e.g. a room render plus front/rear desk views under "B921-2016").
# Pure visual embeddings often keep those views apart, so this deterministic
# post-pass unions clusters whose members share the same PDF page *and* a
# matching SKU prefix in their caption/OCR text snippets.

#: "B921-2016" -> family "B921". Tolerates OCR spacing/punctuation noise and
#: SKUs glued to Chinese caption text ("B921-2016班台": no word boundary
#: exists between ASCII digits and CJK, so the tail uses a lookahead).
SKU_RE = re.compile(r"\b([A-Z]{1,5}\d{2,5})\s*[-–—_]\s*(\d{2,5}[A-Z]?)(?![0-9A-Z])")


def extract_sku_families(text: str) -> set[str]:
    """Return SKU family prefixes found in ``text`` (e.g. ``{"B921"}``).

    Both the family (``B921``) and the full SKU (``B921-2016``) are returned
    so callers can match on either granularity. Empty set when no SKU-like
    token is present.
    """
    families: set[str] = set()
    for match in SKU_RE.finditer((text or "").upper()):
        families.add(match.group(1))
        families.add(f"{match.group(1)}-{match.group(2)}")
    return families


def _page_view_key(source_pdf: Any, page_number: Any) -> tuple[str, int] | None:
    if not source_pdf or page_number is None:
        return None
    try:
        return (str(source_pdf), int(page_number))
    except (TypeError, ValueError):
        return None


def merge_same_page_views(
    result: ClusterResult,
    metadata: dict[str, dict[str, Any]],
) -> ClusterResult:
    """Union clusters whose members co-occur on one PDF page with one SKU family.

    ``metadata`` maps ``image_id`` -> ``{"source_pdf", "page_number", "snippet"}``.
    Two clusters merge when a member of each shares the same
    ``(source_pdf, page_number)`` page key *and* at least one SKU family
    extracted from their snippets. Members without a detectable SKU never
    trigger a merge (conservative: avoids fusing unrelated same-page items).

    Returns a new ``ClusterResult`` with renumbered ``clu_XXXX`` ids,
    largest-first order, and ``page_merges`` counting absorbed clusters.
    """
    clusters = list(result.clusters)
    if len(clusters) < 2:
        return result

    # Union-find over cluster positions.
    parent = list(range(len(clusters)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[max(ri, rj)] = min(ri, rj)

    # page_key -> family -> cluster positions holding an image with both.
    index: dict[tuple, dict[str, set[int]]] = {}
    for pos, cluster in enumerate(clusters):
        for member in cluster.member_ids:
            meta = metadata.get(member) or {}
            page_key = _page_view_key(meta.get("source_pdf"), meta.get("page_number"))
            if page_key is None:
                continue
            families = extract_sku_families(str(meta.get("snippet") or ""))
            if not families:
                continue
            bucket = index.setdefault(page_key, {})
            for family in families:
                bucket.setdefault(family, set()).add(pos)

    for bucket in index.values():
        for positions in bucket.values():
            ordered = sorted(positions)
            for other in ordered[1:]:
                union(ordered[0], other)

    groups: dict[int, list[int]] = {}
    for pos in range(len(clusters)):
        groups.setdefault(find(pos), []).append(pos)

    if len(groups) == len(clusters):
        return result # nothing merged

    merged: list[ClusterItem] = []
    for positions in groups.values():
        if len(positions) == 1:
            merged.append(clusters[positions[0]])
            continue
        # Deterministic survivor: biggest cluster wins, ties -> smallest id.
        ordered = sorted(
            (clusters[p] for p in positions), key=lambda c: (-c.size, c.cluster_id)
        )
        members: list[str] = []
        for cluster in sorted(
            (clusters[p] for p in positions), key=lambda c: c.cluster_id
        ):
            members.extend(cluster.member_ids)
        members = list(dict.fromkeys(members))
        survivor = ordered[0]
        rep = survivor.representative_id if survivor.representative_id in members else members[0]
        merged.append(
            ClusterItem(cluster_id=survivor.cluster_id, member_ids=members,
                        representative_id=rep, size=len(members))
        )

    # Renumber deterministically, largest first.
    merged.sort(key=lambda c: (-c.size, c.cluster_id))
    renumbered = [
        ClusterItem(f"clu_{i:04d}", c.member_ids, c.representative_id, c.size)
        for i, c in enumerate(merged, start=1)
    ]
    return ClusterResult(
        clusters=renumbered,
        method=result.method,
        threshold=result.threshold,
        embedding_dim=result.embedding_dim,
        page_merges=len(clusters) - len(merged),
    )
