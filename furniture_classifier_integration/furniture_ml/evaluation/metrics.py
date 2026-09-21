"""Pure-numpy classification metrics (no sklearn required at train time)."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

def confusion_matrix(y_true, y_pred, num_classes: int) -> np.ndarray:
    y_true = np.asarray(y_true, dtype=int)
    y_pred = np.asarray(y_pred, dtype=int)
    matrix = np.zeros((num_classes, num_classes), dtype=np.int64)
    np.add.at(matrix, (y_true, y_pred), 1)
    return matrix

@dataclass
class ClassificationMetrics:
    classes: list[str]
    accuracy: float
    balanced_accuracy: float
    precision_macro: float
    recall_macro: float
    f1_macro: float
    precision_weighted: float
    recall_weighted: float
    f1_weighted: float
    per_class: dict[str, dict[str, float]] = field(default_factory=dict)
    confusion: list[list[int]] = field(default_factory=list)
    support: dict[str, int] = field(default_factory=dict)
    top_confusions: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "classes": self.classes,
            "accuracy": self.accuracy,
            "balanced_accuracy": self.balanced_accuracy,
            "macro_avg": {
                "precision": self.precision_macro,
                "recall": self.recall_macro,
                "f1": self.f1_macro,
            },
            "weighted_avg": {
                "precision": self.precision_weighted,
                "recall": self.recall_weighted,
                "f1": self.f1_weighted,
            },
            "per_class": self.per_class,
            "support": self.support,
            "confusion_matrix": self.confusion,
            "top_confusions": self.top_confusions,
        }

    def text_report(self) -> str:
        width = max((len(c) for c in self.classes), default=10) + 2
        lines = [
            f"{'class'.ljust(width)}{'precision':>10}{'recall':>10}{'f1':>10}{'support':>10}",
            "-" * (width + 40),
        ]
        for name in self.classes:
            m = self.per_class[name]
            lines.append(
                f"{name.ljust(width)}{m['precision']:>10.4f}{m['recall']:>10.4f}"
                f"{m['f1']:>10.4f}{int(m['support']):>10d}"
            )
        lines += [
            "-" * (width + 40),
            f"{'accuracy'.ljust(width)}{'':>10}{'':>10}{self.accuracy:>10.4f}"
            f"{int(sum(self.support.values())):>10d}",
            f"{'macro avg'.ljust(width)}{self.precision_macro:>10.4f}"
            f"{self.recall_macro:>10.4f}{self.f1_macro:>10.4f}"
            f"{int(sum(self.support.values())):>10d}",
            f"{'weighted avg'.ljust(width)}{self.precision_weighted:>10.4f}"
            f"{self.recall_weighted:>10.4f}{self.f1_weighted:>10.4f}"
            f"{int(sum(self.support.values())):>10d}",
        ]
        if self.top_confusions:
            lines += ["", "Most confused pairs:"]
            for item in self.top_confusions:
                lines.append(
                    f" {item['true']} -> {item['predicted']}: {item['count']} "
                    f"({item['rate']:.1%} of '{item['true']}')"
                )
        return "\n".join(lines)

def compute_metrics(y_true, y_pred, classes: list[str], top_k_confusions: int = 6
) -> ClassificationMetrics:
    n = len(classes)
    cm = confusion_matrix(y_true, y_pred, n)

    support = cm.sum(axis=1).astype(float)
    predicted = cm.sum(axis=0).astype(float)
    tp = np.diag(cm).astype(float)

    with np.errstate(divide="ignore", invalid="ignore"):
        precision = np.where(predicted > 0, tp / np.maximum(predicted, 1e-12), 0.0)
        recall = np.where(support > 0, tp / np.maximum(support, 1e-12), 0.0)
        denom = precision + recall
        f1 = np.where(denom > 0, 2 * precision * recall / np.maximum(denom, 1e-12), 0.0)

    total = support.sum()
    accuracy = float(tp.sum() / total) if total else 0.0
    present = support > 0
    balanced = float(recall[present].mean()) if present.any() else 0.0
    weights = support / total if total else np.zeros_like(support)

    per_class = {
        classes[i]: {
            "precision": float(precision[i]),
            "recall": float(recall[i]),
            "f1": float(f1[i]),
            "support": int(support[i]),
        }
        for i in range(n)
    }

    confusions = []
    for i in range(n):
        for j in range(n):
            if i != j and cm[i, j] > 0:
                confusions.append(
                    {
                        "true": classes[i],
                        "predicted": classes[j],
                        "count": int(cm[i, j]),
                        "rate": float(cm[i, j] / support[i]) if support[i] else 0.0,
                    }
                )
    confusions.sort(key=lambda d: (-d["count"], -d["rate"]))

    return ClassificationMetrics(
        classes=list(classes),
        accuracy=accuracy,
        balanced_accuracy=balanced,
        precision_macro=float(precision[present].mean()) if present.any() else 0.0,
        recall_macro=float(recall[present].mean()) if present.any() else 0.0,
        f1_macro=float(f1[present].mean()) if present.any() else 0.0,
        precision_weighted=float((precision * weights).sum()),
        recall_weighted=float((recall * weights).sum()),
        f1_weighted=float((f1 * weights).sum()),
        per_class=per_class,
        confusion=cm.tolist(),
        support={classes[i]: int(support[i]) for i in range(n)},
        top_confusions=confusions[:top_k_confusions],
    )
