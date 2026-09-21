"""Alibaba-style visual search over curated product embeddings."""

from __future__ import annotations

from fastapi import APIRouter, File, UploadFile
from starlette.concurrency import run_in_threadpool

from furniture_ml.api.dependencies import read_image_upload, temp_image
from furniture_ml.curation.service import get_service

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/similar", summary="Find visually similar products by id")
async def similar_by_id(image_id: str, top_k: int = 12) -> dict:
    service = get_service()
    hits = await run_in_threadpool(service.search_by_id, image_id, min(top_k, 50))
    return {"query": {"image_id": image_id}, "count": len(hits), "results": hits}


@router.post("/similar", summary="Find visually similar products by upload")
async def similar_by_upload(
    file: UploadFile = File(...), top_k: int = 12
) -> dict:
    data = await read_image_upload(file)
    service = get_service()

    def _run() -> list[dict]:
        with temp_image(data, file.filename) as path:
            return service.search_by_image(path, top_k=min(top_k, 50))

    hits = await run_in_threadpool(_run)
    return {"query": {"filename": file.filename}, "count": len(hits), "results": hits}
