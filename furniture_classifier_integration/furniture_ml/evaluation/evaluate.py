"""Evaluate the exported model on the held-out test split.

Produces accuracy / precision / recall / F1, per-class metrics, a confusion
matrix (PNG + JSON), a classification report, the most-confused category pairs
and a confidence-threshold sweep that tells you what the ``needs_review`` rate
will be in production.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from furniture_ml.config import Settings, get_settings
from furniture_ml.evaluation.metrics import ClassificationMetrics, compute_metrics
from furniture_ml.exceptions import DatasetError
from furniture_ml.inference.predictor import Predictor
from furniture_ml.utils.io_utils import ensure_dir, read_json, write_csv, write_json
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)

@dataclass
class EvaluationResult:
    split: str
    n_samples: int
    metrics: ClassificationMetrics
    threshold_sweep: list[dict] = field(default_factory=list)
    misclassified: list[dict] = field(default_factory=list)
    artifacts: dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "split": self.split,
            "n_samples": self.n_samples,
            **self.metrics.to_dict(),
            "threshold_sweep": self.threshold_sweep,
            "misclassified_examples": self.misclassified,
            "artifacts": self.artifacts,
        }

def _load_split(settings: Settings, split: str) -> list[tuple[Path, str]]:
    splits_path = settings.artifacts_dir / "splits.json"
    if not splits_path.exists():
        raise DatasetError(
            f"{splits_path} not found. Run training first so the split is recorded."
        )
    data = read_json(splits_path)
    files = data.get("files", {}).get(split, [])
    if not files:
        raise DatasetError(f"Split '{split}' is empty in {splits_path}.")

    from furniture_ml.constants import slug_map

    display = slug_map()
    samples: list[tuple[Path, str]] = []
    for raw in files:
        path = Path(raw)
        category = display.get(path.parent.name)
        if category is None:
            logger.warning("Skipping %s - unknown category folder '%s'", path, path.parent.name)
            continue
        if path.exists():
            samples.append((path, category))
    if not samples:
        raise DatasetError(f"No readable files for split '{split}'.")
    return samples

def evaluate_model(
    *,
    split: str = "test",
    model_path: str | Path | None = None,
    labels_path: str | Path | None = None,
    settings: Settings | None = None,
    thresholds: list[float] | None = None,
    max_misclassified: int = 50,
    make_plots: bool = True,
) -> EvaluationResult:
    settings = settings or get_settings()
    samples = _load_split(settings, split)
    predictor = Predictor(model_path, labels_path, settings=settings, confidence_threshold=0.0)

    paths = [p for p, _ in samples]
    truths = [c for _, c in samples]
    predictions = predictor.predict_batch(paths, threshold=0.0)

    classes = predictor.classes
    class_to_idx = {c: i for i, c in enumerate(classes)}
    unknown = [t for t in truths if t not in class_to_idx]
    if unknown:
        raise DatasetError(f"Labels not present in the model taxonomy: {sorted(set(unknown))}")

    y_true = [class_to_idx[t] for t in truths]
    y_pred = [class_to_idx[p.raw_category] for p in predictions]
    confidences = np.array([p.confidence for p in predictions])

    metrics = compute_metrics(y_true, y_pred, classes)

    sweep = []
    for threshold in (thresholds or [0.0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]):
        accepted = confidences >= threshold
        n_accepted = int(accepted.sum())
        correct = np.array(y_true) == np.array(y_pred)
        sweep.append(
            {
                "threshold": threshold,
                "auto_classified": n_accepted,
                "needs_review": int(len(y_true) - n_accepted),
                "coverage": round(n_accepted / len(y_true), 4),
                "accuracy_on_accepted": round(
                    float(correct[accepted].mean()) if n_accepted else 0.0, 4
                ),
            }
        )

    misclassified = [
        {
            "image_path": str(paths[i]),
            "true": truths[i],
            "predicted": predictions[i].raw_category,
            "confidence": round(predictions[i].confidence, 4),
        }
        for i in range(len(y_true))
        if y_true[i] != y_pred[i]
    ]
    misclassified.sort(key=lambda d: -d["confidence"])

    artifacts_dir = ensure_dir(settings.artifacts_dir / "evaluation")
    artifacts: dict[str, str] = {}

    report_txt = artifacts_dir / f"{split}_classification_report.txt"
    report_txt.write_text(metrics.text_report(), encoding="utf-8")
    artifacts["classification_report"] = str(report_txt)

    write_csv(
        artifacts_dir / f"{split}_predictions.csv",
        [
            {
                "image_path": str(paths[i]),
                "true_category": truths[i],
                "predicted_category": predictions[i].raw_category,
                "confidence": round(predictions[i].confidence, 4),
                "correct": y_true[i] == y_pred[i],
            }
            for i in range(len(y_true))
        ],
    )
    artifacts["predictions_csv"] = str(artifacts_dir / f"{split}_predictions.csv")

    if make_plots:
        try:
            artifacts["confusion_matrix_png"] = str(
                _plot_confusion(np.array(metrics.confusion), classes,
                    artifacts_dir / f"{split}_confusion_matrix.png")
            )
        except Exception as exc: # pragma: no cover - plotting is optional
            logger.warning("Confusion-matrix plot skipped: %s", exc)

    result = EvaluationResult(
        split=split,
        n_samples=len(y_true),
        metrics=metrics,
        threshold_sweep=sweep,
        misclassified=misclassified[:max_misclassified],
        artifacts=artifacts,
    )
    write_json(artifacts_dir / f"{split}_evaluation.json", result.to_dict())

    logger.info("Evaluation (%s split, %s samples)\n%s", split, len(y_true), metrics.text_report())
    if metrics.top_confusions:
        logger.info(
            "Categories most confused: %s",
            ", ".join(f"{c['true']}->{c['predicted']} ({c['count']})"
                for c in metrics.top_confusions[:3]),
        )
    return result

def _plot_confusion(matrix: np.ndarray, classes: list[str], out_path: Path) -> Path:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    normalised = matrix / np.clip(matrix.sum(axis=1, keepdims=True), 1, None)
    fig, ax = plt.subplots(figsize=(1.4 * len(classes) + 3, 1.2 * len(classes) + 2.5))
    im = ax.imshow(normalised, cmap="Blues", vmin=0, vmax=1)
    ax.set_xticks(range(len(classes)), classes, rotation=40, ha="right", fontsize=9)
    ax.set_yticks(range(len(classes)), classes, fontsize=9)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title("Confusion matrix (row-normalised)")

    for i in range(len(classes)):
        for j in range(len(classes)):
            ax.text(
                j, i, f"{matrix[i, j]}\n{normalised[i, j]:.0%}",
                ha="center", va="center", fontsize=8,
                color="white" if normalised[i, j] > 0.5 else "black",
            )
    fig.colorbar(im, ax=ax, fraction=0.045)
    fig.tight_layout()
    ensure_dir(out_path.parent)
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    return out_path
