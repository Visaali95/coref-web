"""Command-line interface: ``python -m furniture_ml.cli <command>`` or ``fml <command>``."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from furniture_ml import __version__
from furniture_ml.config import get_settings
from furniture_ml.exceptions import FurnitureMLError
from furniture_ml.utils.logging_utils import configure_logging, get_logger

logger = get_logger(__name__)

def _print(payload) -> None:
    print(json.dumps(payload, indent=2, default=str))

# --------------------------------------------------------------------- commands
def cmd_init(args) -> int:
    from furniture_ml.dataset.labeling import scaffold_dataset_dirs

    settings = get_settings()
    settings.ensure_dirs()
    created = scaffold_dataset_dirs(settings)
    _print(
        {
            "project_root": str(settings.project_root),
            "put_your_pdfs_here": str(settings.raw_pdf_dir),
            "dataset_dirs": [str(p) for p in created],
        }
    )
    return 0

def cmd_prepare(args) -> int:
    from furniture_ml.dataset.labeling import LabelStore, scaffold_dataset_dirs
    from furniture_ml.dataset.manifest import Manifest
    from furniture_ml.dataset.prepare import DatasetPreparer, PrepareConfig
    from furniture_ml.pipeline_config import load_pipeline_config

    settings = get_settings()
    scaffold_dataset_dirs(settings)

    extraction, dedup = load_pipeline_config(args.pipeline_config)
    if args.dpi is not None:
        extraction.dpi = args.dpi
    if args.max_pages is not None:
        extraction.max_pages = args.max_pages
    if args.no_region_fallback:
        extraction.region_fallback = False
    if args.always_region_scan:
        extraction.always_region_scan = True
    if args.phash_threshold is not None:
        dedup.phash_threshold = args.phash_threshold
    if args.embedding_dedup:
        dedup.use_embeddings = True

    config = PrepareConfig(extraction=extraction, dedup=dedup)
    result = DatasetPreparer(settings, config).prepare(
        [Path(p) for p in args.pdf] if args.pdf else None
    )

    manifest = Manifest.load(result.manifest_path)
    LabelStore.build(manifest, settings.dataset_dir / "labels.csv")
    payload = result.to_dict()
    payload["labels_csv"] = str(settings.dataset_dir / "labels.csv")
    payload["next_step"] = "fml review (or edit labels.csv, then: fml labels apply)"
    _print(payload)
    return 0

def cmd_review(args) -> int:
    from furniture_ml.dataset.review_tool import build_review_page

    path = build_review_page(only_unlabelled=not args.all, limit=args.limit)
    _print({"review_page": str(path), "open_with": path.as_uri()})
    return 0

def cmd_labels(args) -> int:
    from furniture_ml.dataset.labeling import apply_labels, labelling_status, sync_from_folders

    if args.action == "status":
        _print(labelling_status())
    elif args.action == "apply":
        _print(apply_labels(move=args.move))
    elif args.action == "sync":
        _print(sync_from_folders())
    return 0

def cmd_validate(args) -> int:
    from furniture_ml.dataset.validate import validate_dataset

    report = validate_dataset(min_per_class=args.min_per_class)
    _print(report.to_dict())
    return 0 if report.ok else 1

def cmd_train(args) -> int:
    from furniture_ml.training.train import train

    overrides: dict = {}
    if args.model:
        overrides.setdefault("model", {})["name"] = args.model
    if args.epochs:
        overrides.setdefault("optim", {})["epochs"] = args.epochs
    if args.batch_size:
        overrides.setdefault("data", {})["batch_size"] = args.batch_size
    result = train(args.config, overrides or None)
    _print(
        {
            "classes": result.classes,
            "best_epoch": result.best_epoch,
            "best_score": result.best_score,
            "model": result.export_path,
            "labels": result.labels_path,
            "test_accuracy": result.test_metrics.get("accuracy"),
            "test_f1_macro": result.test_metrics.get("macro_avg", {}).get("f1"),
        }
    )
    return 0

def cmd_evaluate(args) -> int:
    from furniture_ml.evaluation.evaluate import evaluate_model

    result = evaluate_model(split=args.split, model_path=args.model_path)
    print(result.metrics.text_report())
    _print({"artifacts": result.artifacts, "threshold_sweep": result.threshold_sweep})
    return 0

def cmd_benchmark(args) -> int:
    from furniture_ml.training.benchmark import benchmark

    _print(benchmark(args.models, batch_size=args.batch_size))
    return 0

def cmd_predict(args) -> int:
    from furniture_ml.inference.predictor import Predictor

    predictor = Predictor(args.model_path, confidence_threshold=args.threshold)
    paths = []
    for target in args.images:
        path = Path(target)
        paths.extend(sorted(path.rglob("*")) if path.is_dir() else [path])
    from furniture_ml.constants import SUPPORTED_IMAGE_EXTENSIONS

    paths = [p for p in paths if p.suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS]
    results = predictor.predict_batch(paths)
    _print([r.to_dict(args.probabilities) for r in results])
    return 0

def cmd_pdf(args) -> int:
    from furniture_ml.inference.pipeline import PDFClassificationPipeline
    from furniture_ml.pipeline_config import load_pipeline_config

    extraction, dedup = load_pipeline_config()
    if args.dpi is not None:
        extraction.dpi = args.dpi
    if args.max_pages is not None:
        extraction.max_pages = args.max_pages

    pipeline = PDFClassificationPipeline(extraction=extraction, dedup=dedup)
    result = pipeline.run(args.pdf, threshold=args.threshold, keep_files=True)
    _print(result.to_dict(args.probabilities))
    return 0

def cmd_serve(args) -> int:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "furniture_ml.api.app:app",
        host=args.host or settings.api_host,
        port=args.port or settings.api_port,
        reload=args.reload,
        workers=args.workers,
        log_level=settings.log_level.lower(),
    )
    return 0


def cmd_cluster(args) -> int:
    from furniture_ml.curation.service import get_service

    payload = get_service().run_clustering(
        threshold=args.threshold, method=args.method, page_merge=not args.no_page_merge,
    )
    _print(
        {
            "num_clusters": payload["num_clusters"],
            "threshold": payload["threshold"],
            "page_merges": payload.get("page_merges", 0),
            "clusters": payload["clusters"][: args.max_show],
        }
    )
    return 0


def cmd_search(args) -> int:
    from furniture_ml.curation.service import get_service

    hits = get_service().search_by_image(args.image, top_k=args.top_k)
    _print(hits)
    return 0


def cmd_queue(args) -> int:
    from furniture_ml.curation.store import get_store

    store = get_store()
    _print(
        {
            "total": store.count_products(),
            "needs_review": store.count_products("needs_review"),
            "classified": store.count_products("classified"),
            "failed": store.count_products("failed"),
            "clusters": len(store.list_clusters()),
        }
    )
    return 0


def cmd_ingest(args) -> int:
    from furniture_ml.curation.ingest import ingest_manifest

    _print(
        ingest_manifest(
            args.manifest,
            only_unique=not args.include_duplicates,
        )
    )
    return 0


def cmd_export(args) -> int:
    from furniture_ml.dataset.export_training import export_training_set

    report = export_training_set(
        train_ratio=args.train_ratio,
        seed=args.seed,
        min_per_class=args.min_per_class,
        dataset_dir=args.dataset_dir,
    )
    _print(report)
    for warning in report.get("warnings", []):
        logger.warning("%s", warning)
    return 0 if not report.get("small_classes") else 2

# ----------------------------------------------------------------------- parser
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="fml", description="Furniture/product image ML toolkit")
    parser.add_argument("--version", action="version", version=f"furniture-ml {__version__}")
    parser.add_argument("--log-level", default=None)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="Create the data/model directory structure").set_defaults(
        func=cmd_init
    )

    p = sub.add_parser("prepare", help="PDF -> extract -> dedup -> manifest -> labelling queue")
    p.add_argument("pdf", nargs="*", help="PDF path(s); defaults to every PDF in data/raw_pdfs")
    p.add_argument("--pipeline-config", default=None, help="Path to pipeline.yaml")
    p.add_argument("--dpi", type=int, default=None)
    p.add_argument("--max-pages", type=int, default=None)
    p.add_argument("--no-region-fallback", action="store_true")
    p.add_argument("--always-region-scan", action="store_true")
    p.add_argument("--phash-threshold", type=int, default=None)
    p.add_argument(
        "--embedding-dedup", action="store_true",
        help="Additional CNN-embedding near-duplicate pass (slower, stricter)"
    )
    p.set_defaults(func=cmd_prepare)

    p = sub.add_parser("review", help="Generate the HTML labelling tool")
    p.add_argument("--all", action="store_true", help="Include already-labelled images")
    p.add_argument("--limit", type=int, default=None)
    p.set_defaults(func=cmd_review)

    p = sub.add_parser("labels", help="Labelling status / apply / sync")
    p.add_argument("action", choices=["status", "apply", "sync"])
    p.add_argument("--move", action="store_true", help="Move instead of copy when applying")
    p.set_defaults(func=cmd_labels)

    p = sub.add_parser("validate", help="Validate the labelled dataset before training")
    p.add_argument("--min-per-class", type=int, default=20)
    p.set_defaults(func=cmd_validate)

    p = sub.add_parser("train", help="Train the classifier")
    p.add_argument("--config", default=None, help="Path to training.yaml")
    p.add_argument("--model", default=None)
    p.add_argument("--epochs", type=int, default=None)
    p.add_argument("--batch-size", type=int, default=None)
    p.set_defaults(func=cmd_train)

    p = sub.add_parser("evaluate", help="Evaluate the exported model")
    p.add_argument("--split", default="test", choices=["train", "val", "test"])
    p.add_argument("--model-path", default=None)
    p.set_defaults(func=cmd_evaluate)

    p = sub.add_parser("benchmark", help="Compare candidate architectures")
    p.add_argument("--models", nargs="*", default=None)
    p.add_argument("--batch-size", type=int, default=1)
    p.set_defaults(func=cmd_benchmark)

    p = sub.add_parser("predict", help="Classify image file(s) or a folder")
    p.add_argument("images", nargs="+")
    p.add_argument("--model-path", default=None)
    p.add_argument("--threshold", type=float, default=None)
    p.add_argument("--probabilities", action="store_true")
    p.set_defaults(func=cmd_predict)

    p = sub.add_parser("pdf", help="Run the full PDF -> classified JSON pipeline")
    p.add_argument("pdf")
    p.add_argument("--dpi", type=int, default=None)
    p.add_argument("--max-pages", type=int, default=None)
    p.add_argument("--threshold", type=float, default=None)
    p.add_argument("--probabilities", action="store_true")
    p.set_defaults(func=cmd_pdf)

    p = sub.add_parser("serve", help="Run the REST API")
    p.add_argument("--host", default=None)
    p.add_argument("--port", type=int, default=None)
    p.add_argument("--reload", action="store_true")
    p.add_argument("--workers", type=int, default=1)
    p.set_defaults(func=cmd_serve)

    p = sub.add_parser("cluster", help="Embed products and cluster similar items")
    p.add_argument("--threshold", type=float, default=0.92)
    p.add_argument("--method", default="agglomerative", choices=["agglomerative", "dbscan"])
    p.add_argument("--max-show", type=int, default=10)
    p.add_argument(
        "--no-page-merge", action="store_true",
        help="Skip the same-page/SKU multi-view merge pass (on by default)",
    )
    p.set_defaults(func=cmd_cluster)

    p = sub.add_parser("search", help="Visual search for similar products")
    p.add_argument("image")
    p.add_argument("--top-k", type=int, default=12)
    p.set_defaults(func=cmd_search)

    p = sub.add_parser("queue", help="Show curation review-queue counts")
    p.set_defaults(func=cmd_queue)

    p = sub.add_parser("ingest", help="Load data/manifest.csv into the curation review queue (data/curation.db)")
    p.add_argument("--manifest", default=None, help="Path to manifest.csv (default: data/manifest.csv)")
    p.add_argument("--include-duplicates", action="store_true", help="Also ingest rows flagged is_duplicate=true")
    p.set_defaults(func=cmd_ingest)

    p = sub.add_parser("export", help="Export verified curation rows to data/dataset/<slug>/train|val (80/20 split)")
    p.add_argument("--train-ratio", type=float, default=0.8)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--min-per-class", type=int, default=10)
    p.add_argument("--dataset-dir", default=None)
    p.set_defaults(func=cmd_export)

    return parser

def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    configure_logging(args.log_level)
    try:
        return args.func(args)
    except FurnitureMLError as exc:
        logger.error("%s: %s", exc.code, exc.message)
        _print(exc.to_dict())
        return 1
    except KeyboardInterrupt: # pragma: no cover
        logger.warning("Interrupted")
        return 130

if __name__ == "__main__": # pragma: no cover
    sys.exit(main())
