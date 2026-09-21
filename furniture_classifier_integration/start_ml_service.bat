@echo off
REM ─── Furniture ML Classifier Service ────────────────────────────────────────
REM Starts the FastAPI inference server on http://localhost:8000
REM Run this ONCE before starting the Node.js backend.

cd /d "%~dp0"

echo [ML Service] Installing / verifying Python dependencies...
pip install -r requirements-inference.txt --quiet
pip install -e . --quiet

echo.
echo [ML Service] Starting FastAPI server on http://localhost:8000
echo [ML Service] Swagger docs: http://localhost:8000/docs
echo [ML Service] Press Ctrl+C to stop.
echo.

python -m furniture_ml.cli serve --host 0.0.0.0 --port 8000
