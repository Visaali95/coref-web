"""Reproducible training loop: transfer learning, class balancing, checkpointing,
early stopping and model export."""

from __future__ import annotations

import json
import math
import random
import time
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from furniture_ml.config import Settings, get_settings
from furniture_ml.evaluation.metrics import compute_metrics
from furniture_ml.training.config import TrainingConfig, load_training_config
from furniture_ml.training.datamodule import DataModule
from furniture_ml.training.export import export_model, write_label_map
from furniture_ml.training.model_factory import (
    build_model,
    count_parameters,
    set_backbone_trainable,
    split_parameters,
)
from furniture_ml.utils.device import resolve_device
from furniture_ml.utils.io_utils import ensure_dir, write_json
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)

def set_seed(seed: int) -> None:
    import torch

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

@dataclass
class EpochResult:
    epoch: int
    train_loss: float
    val_loss: float
    val_accuracy: float
    val_f1_macro: float
    lr: float
    seconds: float

@dataclass
class TrainingResult:
    classes: list[str]
    best_epoch: int
    best_score: float
    monitor: str
    history: list[EpochResult] = field(default_factory=list)
    checkpoint_path: str = ""
    export_path: str = ""
    labels_path: str = ""
    split_stats: dict = field(default_factory=dict)
    test_metrics: dict = field(default_factory=dict)
    duration_seconds: float = 0.0

    def to_dict(self) -> dict:
        return {
            "classes": self.classes,
            "monitor": self.monitor,
            "best_epoch": self.best_epoch,
            "best_score": self.best_score,
            "checkpoint_path": self.checkpoint_path,
            "export_path": self.export_path,
            "labels_path": self.labels_path,
            "split_stats": self.split_stats,
            "test_metrics": self.test_metrics,
            "duration_seconds": self.duration_seconds,
            "history": [h.__dict__ for h in self.history],
        }

class Trainer:
    def __init__(self, config: TrainingConfig | None = None, settings: Settings | None = None):
        self.config = config or load_training_config()
        self.settings = settings or get_settings()
        self.device = resolve_device()

    # ------------------------------------------------------------------ API
    def run(self) -> TrainingResult:
        import torch
        from torch import nn

        cfg = self.config
        set_seed(cfg.data.seed)
        self.settings.ensure_dirs()
        started = time.perf_counter()

        data = DataModule(cfg)
        stats = data.setup()
        train_loader, val_loader, test_loader = data.dataloaders()

        model = build_model(
            cfg.model.name,
            num_classes=len(data.classes),
            pretrained=cfg.model.pretrained,
            drop_rate=cfg.model.drop_rate,
            drop_path_rate=cfg.model.drop_path_rate,
        ).to(self.device)
        logger.info(
            "Model %s | %s params | device=%s",
            cfg.model.name, f"{count_parameters(model):,}", self.device,
        )

        weights = data.class_weights()
        criterion = nn.CrossEntropyLoss(
            weight=None if weights is None else weights.to(self.device),
            label_smoothing=cfg.optim.label_smoothing,
        )
        optimizer = self._optimizer(model)
        scheduler = self._scheduler(optimizer, len(train_loader))
        use_amp = bool(cfg.optim.amp and self.device.startswith("cuda"))
        try:
            scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
        except (AttributeError, TypeError): # torch < 2.3
            scaler = torch.cuda.amp.GradScaler(enabled=use_amp)

        models_dir = ensure_dir(Path(cfg.output.models_dir or self.settings.models_dir))
        artifacts_dir = ensure_dir(Path(cfg.output.artifacts_dir or self.settings.artifacts_dir))
        checkpoint_path = models_dir / cfg.output.checkpoint_name

        es = cfg.early_stopping
        best_score = -math.inf if es.mode == "max" else math.inf
        best_epoch = -1
        patience = 0
        history: list[EpochResult] = []

        for epoch in range(1, cfg.optim.epochs + 1):
            epoch_start = time.perf_counter()

            frozen = epoch <= cfg.model.freeze_backbone_epochs
            set_backbone_trainable(model, not frozen)
            if frozen:
                logger.info("Epoch %s: backbone frozen (linear probe warm-up)", epoch)

            train_loss = self._train_epoch(
                model, train_loader, criterion, optimizer, scaler, scheduler, use_amp
            )
            val_loss, y_true, y_pred, _ = self._evaluate(model, val_loader, criterion)
            metrics = compute_metrics(y_true, y_pred, data.classes)

            result = EpochResult(
                epoch=epoch,
                train_loss=round(train_loss, 5),
                val_loss=round(val_loss, 5),
                val_accuracy=round(metrics.accuracy, 5),
                val_f1_macro=round(metrics.f1_macro, 5),
                lr=round(optimizer.param_groups[0]["lr"], 8),
                seconds=round(time.perf_counter() - epoch_start, 2),
            )
            history.append(result)
            logger.info(
                "epoch %02d/%02d | train_loss %.4f | val_loss %.4f | val_acc %.4f | "
                "val_f1 %.4f | %.1fs",
                epoch, cfg.optim.epochs, result.train_loss, result.val_loss,
                result.val_accuracy, result.val_f1_macro, result.seconds,
            )

            score = {
                "val_f1_macro": result.val_f1_macro,
                "val_accuracy": result.val_accuracy,
                "val_loss": result.val_loss,
            }[es.monitor]
            improved = (
                score > best_score + es.min_delta if es.mode == "max"
                else score < best_score - es.min_delta
            )
            if improved:
                best_score, best_epoch, patience = score, epoch, 0
                torch.save(
                    {
                        "model_state": model.state_dict(),
                        "classes": data.classes,
                        "model_name": cfg.model.name,
                        "image_size": cfg.data.image_size,
                        "epoch": epoch,
                        "score": score,
                        "monitor": es.monitor,
                        "config": cfg.to_dict(),
                    },
                    checkpoint_path,
                )
                logger.info(" -> new best (%s=%.5f), checkpoint saved", es.monitor, score)
            else:
                patience += 1
                if es.enabled and patience >= es.patience:
                    logger.info("Early stopping at epoch %s (patience %s)", epoch, es.patience)
                    break

        # -------- restore best & final test evaluation --------
        checkpoint = torch.load(checkpoint_path, map_location=self.device, weights_only=False)
        model.load_state_dict(checkpoint["model_state"])

        test_loss, y_true, y_pred, probs = self._evaluate(model, test_loader, criterion)
        test_metrics = compute_metrics(y_true, y_pred, data.classes)
        logger.info("Test set results:\n%s", test_metrics.text_report())

        labels_path = write_label_map(
            data.classes,
            Path(cfg.output.models_dir or self.settings.models_dir) / cfg.output.labels_name,
            model_name=cfg.model.name,
            image_size=cfg.data.image_size,
        )
        export_path = export_model(
            model,
            classes=data.classes,
            config=cfg,
            models_dir=models_dir,
            device=self.device,
        )

        result = TrainingResult(
            classes=data.classes,
            best_epoch=best_epoch,
            best_score=float(best_score),
            monitor=es.monitor,
            history=history,
            checkpoint_path=str(checkpoint_path),
            export_path=str(export_path),
            labels_path=str(labels_path),
            split_stats=stats.to_dict(),
            test_metrics=test_metrics.to_dict(),
            duration_seconds=round(time.perf_counter() - started, 2),
        )
        write_json(artifacts_dir / "training_report.json", result.to_dict())
        (artifacts_dir / "test_classification_report.txt").write_text(
            test_metrics.text_report(), encoding="utf-8"
        )
        np.save(artifacts_dir / "test_probabilities.npy", probs)
        write_json(artifacts_dir / "test_predictions.json",
            {"y_true": list(map(int, y_true)), "y_pred": list(map(int, y_pred)),
            "classes": data.classes})
        logger.info("Training complete in %.1fs. Model exported to %s",
            result.duration_seconds, export_path)
        return result

    # ------------------------------------------------------------- internals
    def _optimizer(self, model):
        import torch

        cfg = self.config.optim
        backbone, head = split_parameters(model)
        groups = [
            {"params": backbone, "lr": cfg.lr},
            {"params": head, "lr": cfg.lr * cfg.head_lr_multiplier},
        ]
        if cfg.optimizer.lower() == "sgd":
            return torch.optim.SGD(
                groups, lr=cfg.lr, momentum=cfg.momentum,
                weight_decay=cfg.weight_decay, nesterov=True,
            )
        return torch.optim.AdamW(groups, lr=cfg.lr, weight_decay=cfg.weight_decay)

    def _scheduler(self, optimizer, steps_per_epoch: int):
        import torch

        cfg = self.config.optim
        if cfg.scheduler == "none" or steps_per_epoch == 0:
            return None
        total_steps = max(cfg.epochs * steps_per_epoch, 1)
        warmup_steps = max(cfg.warmup_epochs * steps_per_epoch, 0)

        if cfg.scheduler == "step":
            return torch.optim.lr_scheduler.StepLR(
                optimizer, step_size=max(steps_per_epoch * 10, 1), gamma=0.1
            )

        def lr_lambda(step: int) -> float:
            if warmup_steps and step < warmup_steps:
                return (step + 1) / warmup_steps
            progress = (step - warmup_steps) / max(total_steps - warmup_steps, 1)
            return 0.5 * (1.0 + math.cos(math.pi * min(progress, 1.0)))

        return torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)

    def _train_epoch(self, model, loader, criterion, optimizer, scaler, scheduler, use_amp):
        import torch

        model.train()
        total, seen = 0.0, 0
        for images, targets in loader:
            images = images.to(self.device, non_blocking=True)
            targets = targets.to(self.device, non_blocking=True)

            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device_type="cuda", enabled=use_amp):
                outputs = model(images)
                loss = criterion(outputs, targets)

            if use_amp:
                scaler.scale(loss).backward()
                if self.config.optim.grad_clip:
                    scaler.unscale_(optimizer)
                    torch.nn.utils.clip_grad_norm_(model.parameters(), self.config.optim.grad_clip)
                scaler.step(optimizer)
                scaler.update()
            else:
                loss.backward()
                if self.config.optim.grad_clip:
                    torch.nn.utils.clip_grad_norm_(model.parameters(), self.config.optim.grad_clip)
                optimizer.step()

            if scheduler is not None:
                scheduler.step()

            total += float(loss.item()) * images.size(0)
            seen += images.size(0)
        return total / max(seen, 1)

    def _evaluate(self, model, loader, criterion):
        import torch

        model.eval()
        total, seen = 0.0, 0
        y_true, y_pred, probabilities = [], [], []
        with torch.no_grad():
            for images, targets in loader:
                images = images.to(self.device, non_blocking=True)
                targets = targets.to(self.device, non_blocking=True)
                outputs = model(images)
                loss = criterion(outputs, targets)
                probs = torch.softmax(outputs.float(), dim=1)

                total += float(loss.item()) * images.size(0)
                seen += images.size(0)
                y_true.extend(targets.cpu().tolist())
                y_pred.extend(probs.argmax(dim=1).cpu().tolist())
                probabilities.append(probs.cpu().numpy())

        probs_array = (
            np.concatenate(probabilities, axis=0) if probabilities else np.empty((0, 0))
        )
        return total / max(seen, 1), y_true, y_pred, probs_array

def train(config_path: str | Path | None = None, overrides: dict | None = None) -> TrainingResult:
    """Convenience entry point used by the CLI and scripts/train.py."""
    config = load_training_config(config_path, overrides)
    logger.info("Training config:\n%s", json.dumps(config.to_dict(), indent=2))
    return Trainer(config).run()
