"""Environment-driven configuration.

Nothing is hardcoded to a machine: every path defaults to a location *relative to
the project root* and can be overridden with an ``FML_*`` environment variable or
a ``.env`` file.
"""

from __future__ import annotations

import functools
from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# src/furniture_ml/config.py (or furniture_ml/config.py) -> project root is 2 levels up
PROJECT_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="FML_",
        env_file=(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        protected_namespaces=("settings_",),
    )

    project_root: Path = PROJECT_ROOT

    # --- directories -----------------------------------------------------
    data_dir: Path = Path("data")
    models_dir: Path = Path("models")
    artifacts_dir: Path = Path("artifacts")
    upload_dir: Path = Path("data/uploads")

    # --- model -----------------------------------------------------------
    model_path: Path = Path("models/classifier.pt")
    labels_path: Path = Path("models/labels.json")

    # --- inference -------------------------------------------------------
    confidence_threshold: float = Field(default=0.60, ge=0.0, le=1.0)
    device: str = "auto"
    batch_size: int = Field(default=16, ge=1, le=512)
    image_size: int = Field(default=224, ge=32, le=1024)

    # --- api -------------------------------------------------------------
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    max_upload_mb: int = Field(default=50, ge=1, le=2048)
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])
    api_title: str = "Furniture / Product Image Classification API"

    # --- logging ---------------------------------------------------------
    log_level: str = "INFO"
    log_json: bool = False

    # ---------------------------------------------------------------------
    @field_validator("log_level")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()

    @model_validator(mode="after")
    def _absolutise(self) -> "Settings":
        root = self.project_root.resolve()
        object.__setattr__(self, "project_root", root)
        for name in (
            "data_dir",
            "models_dir",
            "artifacts_dir",
            "upload_dir",
            "model_path",
            "labels_path",
        ):
            value: Path = getattr(self, name)
            if not value.is_absolute():
                object.__setattr__(self, name, (root / value).resolve())
        return self

    # --- derived paths ---------------------------------------------------
    @property
    def raw_pdf_dir(self) -> Path:
        return self.data_dir / "raw_pdfs"

    @property
    def extracted_dir(self) -> Path:
        """Raw images extracted from PDFs (pre-dedup)."""
        return self.data_dir / "extracted"

    @property
    def dataset_dir(self) -> Path:
        """Curated, labelled dataset (ImageFolder layout)."""
        return self.data_dir / "dataset"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    def ensure_dirs(self) -> None:
        for d in (
            self.data_dir,
            self.models_dir,
            self.artifacts_dir,
            self.upload_dir,
            self.raw_pdf_dir,
            self.extracted_dir,
            self.dataset_dir,
        ):
            d.mkdir(parents=True, exist_ok=True)


@functools.lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def reload_settings() -> Settings:
    get_settings.cache_clear()
    return get_settings()