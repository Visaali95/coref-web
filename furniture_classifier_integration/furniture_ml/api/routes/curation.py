"""Admin curation endpoints: verify classifications + custom products."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from furniture_ml.api.dependencies import read_image_upload
from furniture_ml.constants import CATEGORIES
from furniture_ml.curation.store import get_store
from furniture_ml.config import get_settings
from furniture_ml.utils.io_utils import ensure_dir

router = APIRouter(prefix="/products", tags=["curation"])


@router.get("", summary="List curated products")
def list_products(
    status: str | None = None,
    category: str | None = None,
    cluster_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    store = get_store()
    items = store.list_products(
        status=status, category=category, cluster_id=cluster_id,
        limit=min(limit, 1000), offset=offset,
    )
    return {"total": store.count_products(), "count": len(items), "items": items}


@router.patch("/{image_id}", summary="Verify / correct a classification")
def update_product(image_id: str, payload: dict) -> dict:
    store = get_store()
    if payload.get("category") and payload["category"] not in (*CATEGORIES, "Unknown"):
        raise HTTPException(422, f"Unknown category: {payload['category']}")
    if payload.get("status") and payload["status"] not in {
        "classified", "needs_review", "failed",
    }:
        raise HTTPException(422, f"Unknown status: {payload['status']}")
    updated = store.update_product(
        image_id,
        category=payload.get("category"),
        status=payload.get("status"),
        cluster_id=payload.get("cluster_id"),
    )
    if updated is None:
        raise HTTPException(404, f"Unknown product: {image_id}")
    return updated


@router.post("", summary="Add a custom product (admin upload)")
async def create_product(
    file: UploadFile = File(...),
    category: str = Form(...),
    cluster_id: str | None = Form(None),
) -> dict:
    if category not in CATEGORIES:
        raise HTTPException(422, f"Category must be one of {CATEGORIES}")
    data = await read_image_upload(file)
    settings = get_settings()
    custom_dir = ensure_dir(settings.data_dir / "custom_products")
    filename = f"{int(__import__('time').time()*1000)}_{Path(file.filename or 'upload.jpg').name}"
    path = custom_dir / filename
    path.write_bytes(data)
    return get_store().create_custom_product(str(path), category, cluster_id)


@router.delete("/{image_id}", summary="Delete a product record")
def delete_product(image_id: str) -> dict:
    if not get_store().delete_product(image_id):
        raise HTTPException(404, f"Unknown product: {image_id}")
    return {"deleted": image_id}


@router.get("/queue/summary", summary="Review queue counts")
def queue_summary() -> dict:
    store = get_store()
    return {
        "total": store.count_products(),
        "needs_review": store.count_products("needs_review"),
        "classified": store.count_products("classified"),
        "failed": store.count_products("failed"),
    }
