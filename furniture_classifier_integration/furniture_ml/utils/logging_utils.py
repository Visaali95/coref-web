"""Centralised logging configuration (plain text or JSON lines)."""

from __future__ import annotations

import json
import logging
import sys
from typing import Any

_CONFIGURED = False


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        for key, value in getattr(record, "extra_fields", {}).items():
            payload[key] = value
        return json.dumps(payload, default=str)


def configure_logging(level: str | None = None, as_json: bool | None = None) -> None:
    """Idempotently configure the root logger."""
    global _CONFIGURED

    from furniture_ml.config import get_settings

    settings = get_settings()
    level = (level or settings.log_level).upper()
    as_json = settings.log_json if as_json is None else as_json

    root = logging.getLogger()
    if _CONFIGURED:
        root.setLevel(level)
        return

    handler = logging.StreamHandler(sys.stdout)
    if as_json:
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s | %(levelname)-7s | %(name)-32s | %(message)s",
                datefmt="%H:%M:%S",
            )
        )
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # Silence noisy third-party loggers.
    for noisy in ("PIL", "matplotlib", "urllib3", "fsspec", "timm"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    configure_logging()
    return logging.getLogger(name)
