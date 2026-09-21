"""Architecture selection helper.

Measures parameter count, fp32 export size and CPU/GPU latency for the shortlisted
backbones so the choice of architecture is evidence-based rather than assumed.

python -m furniture_ml.training.benchmark
"""

from __future__ import annotations

import statistics
import time
from pathlib import Path

from furniture_ml.config import get_settings
from furniture_ml.training.model_factory import MODEL_ZOO
from furniture_ml.utils.device import resolve_device
from furniture_ml.utils.io_utils import ensure_dir, write_json
from furniture_ml.utils.logging_utils import get_logger

logger = get_logger(__name__)

def benchmark(models: list[str] | None = None, *, num_classes: int = 6,
    batch_size: int = 1, runs: int = 20, warmup: int = 5) -> list[dict]:
    import torch

    from furniture_ml.training.model_factory import build_model, count_parameters

    device = resolve_device()
    names = models or list(MODEL_ZOO)
    rows: list[dict] = []

    for name in names:
        spec = MODEL_ZOO.get(name)
        size = spec.default_size if spec else 224
        try:
            model = build_model(name, num_classes, pretrained=False).eval().to(device)
        except Exception as exc:
            logger.warning("Skipping %s: %s", name, exc)
            continue

        dummy = torch.randn(batch_size, 3, size, size, device=device)
        with torch.no_grad():
            for _ in range(warmup):
                model(dummy)
            if device.startswith("cuda"):
                torch.cuda.synchronize()
            timings = []
            for _ in range(runs):
                start = time.perf_counter()
                model(dummy)
                if device.startswith("cuda"):
                    torch.cuda.synchronize()
                timings.append((time.perf_counter() - start) * 1000)

        params = count_parameters(model)
        rows.append(
            {
                "model": name,
                "params_millions": round(params / 1e6, 2),
                "fp32_size_mb": round(params * 4 / 1024 / 1024, 1),
                "input_size": size,
                "device": device,
                "latency_ms_median": round(statistics.median(timings), 2),
                "latency_ms_p95": round(sorted(timings)[int(0.95 * len(timings)) - 1], 2),
                "throughput_img_per_s": round(batch_size * 1000 / statistics.median(timings), 1),
                "notes": spec.notes if spec else "",
            }
        )
        del model
        if device.startswith("cuda"):
            torch.cuda.empty_cache()

    rows.sort(key=lambda r: r["latency_ms_median"])
    out = ensure_dir(get_settings().artifacts_dir) / "model_benchmark.json"
    write_json(out, {"device": device, "batch_size": batch_size, "results": rows})
    logger.info("Benchmark written to %s", out)
    for row in rows:
        logger.info(
            "%-24s %6.2f M params | %5.1f MB | %7.2f ms | %6.1f img/s",
            row["model"], row["params_millions"], row["fp32_size_mb"],
            row["latency_ms_median"], row["throughput_img_per_s"],
        )
    return rows

if __name__ == "__main__": # pragma: no cover
    benchmark()
