"""FastAPI service exposing the classifier to the Node.js/TypeScript application."""

from furniture_ml.api.app import create_app

__all__ = ["create_app"]
