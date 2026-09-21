"""Cluster management: run / list / merge / split (all free & local)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from furniture_ml.curation.service import get_service
from furniture_ml.curation.store import get_store

router = APIRouter(prefix="/clusters", tags=["clusters"])


class RunRequest(BaseModel):
    threshold: float = Field(default=0.92, ge=0.0, le=1.0)
    method: str = Field(default="agglomerative")
    page_merge: bool = Field(
        default=True,
        description="Union clusters whose members share one PDF page + SKU family",
    )


class MergeRequest(BaseModel):
    source_ids: list[str] = Field(min_length=2)
    target_id: str | None = None


class SplitRequest(BaseModel):
    groups: list[list[str]] = Field(min_length=2)


@router.post("/run", summary="Embed all products and cluster similar items")
async def run_clustering(payload: RunRequest) -> dict:
    if payload.method not in {"agglomerative", "dbscan"}:
        raise HTTPException(422, "method must be agglomerative|dbscan")
    service = get_service()
    return await run_in_threadpool(
        service.run_clustering, threshold=payload.threshold, method=payload.method,
        page_merge=payload.page_merge,
    )


@router.get("", summary="List clusters with members")
def list_clusters() -> dict:
    items = get_store().list_clusters()
    return {"count": len(items), "clusters": items}


@router.post("/merge", summary="Merge clusters (admin curation)")
def merge_clusters(payload: MergeRequest) -> dict:
    try:
        return get_store().merge_clusters(payload.source_ids, payload.target_id)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/{cluster_id}/split", summary="Split a cluster into groups")
def split_cluster(cluster_id: str, payload: SplitRequest) -> dict:
    try:
        created = get_store().split_cluster(cluster_id, payload.groups)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"cluster_id": cluster_id, "created": created}
