"""
ml-service/app.py — Datalyze ML Service

Standalone FastAPI service responsible for all heavy ML computation:
  - Supervised learning (Classification, Regression) via scikit-learn
  - Clustering (KMeans, DBSCAN, Agglomerative) via scikit-learn
  - Deep Learning simulation / RunPod GPU dispatch
  - NLP model simulation / RunPod GPU dispatch

Communication:
  - Receives requests from Backend (never from Frontend directly)
  - Accepts dataset as base64-encoded CSV in request body
  - Returns JSON results to Backend

Deployment:
  - Render (initial), RunPod (GPU upgrade, no Backend changes required)
  - Port: 8001 (default)

Environment Variables:
  - GPU_PROVIDER, GPU_API_KEY, GPU_ENDPOINT, GPU_WEBHOOK_SECRET, GPU_MAX_RUNTIME
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from dotenv import load_dotenv

# Load env vars from ml-service/.env
ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(dotenv_path=ENV_PATH, override=True)

from routes import train as train_routes
from routes import automl as automl_routes

app = FastAPI(
    title="Datalyze ML Service",
    description="Standalone ML compute service — handles training, clustering, DL, NLP.",
    version="1.0.0"
)

# CORS: Only accept requests from the Backend service
# In production, restrict allow_origins to your Backend URL
BACKEND_URL = os.getenv("BACKEND_URL", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[BACKEND_URL] if BACKEND_URL != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(train_routes.router, prefix="/train", tags=["Training"])
app.include_router(automl_routes.router, prefix="/automl", tags=["AutoML"])


# ── Exception handlers ────────────────────────────────────────────────────────
@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": True, "detail": str(exc.detail)}
    )

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={"error": True, "detail": str(exc)}
    )

@app.exception_handler(Exception)
async def generic_error_handler(request, exc):
    print(f"[ML SERVICE] Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": True, "detail": f"Internal ML Service error: {str(exc)}"}
    )


# ── Health & Root ─────────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {
        "service": "Datalyze ML Service",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    """
    Health endpoint — used by Backend to verify ML Service is reachable,
    and by Render/RunPod for container health checks.
    """
    gpu_provider = os.getenv("GPU_PROVIDER", "runpod")
    gpu_key = os.getenv("GPU_API_KEY", "")
    gpu_endpoint = os.getenv("GPU_ENDPOINT", "")

    gpu_configured = (
        bool(gpu_key) and "###" not in gpu_key and
        bool(gpu_endpoint) and "###" not in gpu_endpoint
    )

    return {
        "status": "ok",
        "ready": True,
        "gpu_provider": gpu_provider,
        "gpu_configured": gpu_configured,
        "mode": "gpu" if gpu_configured else "simulation",
        "version": "1.0.0"
    }
