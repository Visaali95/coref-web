"""FastAPI application factory."""

from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from furniture_ml import __version__
from furniture_ml.api.routes import classify, clusters, curation, pdf_routes, search, system
from furniture_ml.config import get_settings
from furniture_ml.exceptions import FurnitureMLError
from furniture_ml.utils.logging_utils import configure_logging, get_logger

logger = get_logger(__name__)

API_PREFIX = "/api/v1"

DESCRIPTION = """
Standalone ML service that extracts product/furniture images from catalogue PDFs
and classifies them into three categories (Office Furniture, Villa Furniture, Chandelier).

**Workflow:** `PDF upload -> page processing -> image extraction -> duplicate removal
-> preprocessing -> ML classification -> confidence check -> category assignment -> JSON`

Every response is plain JSON, designed to be consumed over HTTP from a
Node.js / TypeScript application.
"""

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging()
    settings.ensure_dirs()
    logger.info("Starting %s v%s", settings.api_title, __version__)
    try:
        from furniture_ml.inference.predictor import get_predictor

        predictor = get_predictor()
        logger.info("Model preloaded: %s", predictor.info)
    except Exception as exc:
        logger.warning(
            "Model not loaded at startup (%s). /health will report 'degraded' until "
            "a trained model exists at the configured path.", exc,
        )
    yield
    logger.info("Shutting down")

def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.api_title,
        version=__version__,
        description=DESCRIPTION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---------------------------------------------------------- middleware
    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except FurnitureMLError as exc:
            logger.warning("[%s] %s", request_id, exc.message)
            return JSONResponse(status_code=exc.status_code, content=exc.to_dict())
        elapsed = (time.perf_counter() - started) * 1000
        response.headers["x-request-id"] = request_id
        response.headers["x-process-time-ms"] = f"{elapsed:.1f}"
        logger.info(
            "[%s] %s %s -> %s (%.1f ms)",
            request_id, request.method, request.url.path, response.status_code, elapsed,
        )
        return response

    # ------------------------------------------------------ error handlers
    @app.exception_handler(FurnitureMLError)
    async def domain_error_handler(_: Request, exc: FurnitureMLError):
        return JSONResponse(status_code=exc.status_code, content=exc.to_dict())

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "request_validation_error",
                    "message": "The request payload is invalid.",
                    "detail": exc.errors(),
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_: Request, exc: Exception):
        logger.exception("Unhandled error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "An unexpected error occurred.",
                    "detail": str(exc),
                }
            },
        )

    # ------------------------------------------------------------- routes
    app.include_router(system.router, prefix=API_PREFIX)
    app.include_router(classify.router, prefix=API_PREFIX)
    app.include_router(pdf_routes.router, prefix=API_PREFIX)
    app.include_router(clusters.router, prefix=API_PREFIX)
    app.include_router(search.router, prefix=API_PREFIX)
    app.include_router(curation.router, prefix=API_PREFIX)

    @app.get("/admin", include_in_schema=False)
    def admin():
        from pathlib import Path

        from fastapi.responses import HTMLResponse

        html = Path(__file__).with_name("static").joinpath("admin.html")
        return HTMLResponse(html.read_text(encoding="utf-8") if html.exists() else "Admin UI missing")

    @app.get("/", include_in_schema=False)
    def root():
        return {
            "service": settings.api_title,
            "version": __version__,
            "docs": "/docs",
            "health": f"{API_PREFIX}/health",
        }

    # Health is also exposed unprefixed for container orchestrators.
    app.include_router(system.router, include_in_schema=False)

    return app

app = create_app()
