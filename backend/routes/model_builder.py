"""
backend/routes/model_builder.py

API Gateway for ML model building.

Responsibilities (Backend):
  - File upload and storage
  - Input validation
  - Column analysis and recommendations

ML Delegation (to ML Service):
  - /train → delegates to ML_SERVICE_URL/train/run
  - /cluster → delegates to ML_SERVICE_URL/train/cluster

The Backend reads the dataset file from disk, encodes it as base64,
and forwards it to the ML Service. No shared filesystem required.
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from typing import Optional
import pandas as pd
import numpy as np
import io
import uuid
import os
import json
import base64
import httpx

router = APIRouter()

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
RAW_DIR = os.path.join(DATA_DIR, "raw")

os.makedirs(RAW_DIR, exist_ok=True)

# ── ML Service URL ─────────────────────────────────────────────────────────────
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8001")


def _get_ml_service_url() -> str:
    """Get ML Service URL from environment (allows runtime override)."""
    return os.getenv("ML_SERVICE_URL", "http://localhost:8001")


def _read_dataset(raw_path: str) -> pd.DataFrame:
    """Read a CSV or Excel file into a DataFrame."""
    if raw_path.endswith('.csv'):
        return pd.read_csv(raw_path)
    else:
        return pd.read_excel(raw_path)


def _encode_dataset_b64(raw_path: str) -> str:
    """
    Read a dataset file and return its content as a base64-encoded CSV string.
    Excel files are converted to CSV before encoding for ML Service compatibility.
    """
    df = _read_dataset(raw_path)
    csv_bytes = df.to_csv(index=False).encode('utf-8')
    return base64.b64encode(csv_bytes).decode('utf-8')


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """
    Accepts CSV/Excel upload, reads it into pandas, and infers modeling defaults.
    This stays entirely in the Backend — no ML Service call needed for upload.
    """
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")

    contents = await file.read()
    if len(contents) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Dataset file too large. Maximum size allowed is 25MB.")

    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    if df.empty or len(df.columns) < 2:
        raise HTTPException(status_code=400, detail="Dataset must have at least 1 feature and 1 target row.")

    dataset_id = str(uuid.uuid4())
    _, ext = os.path.splitext(file.filename)
    if not ext:
        ext = '.csv' if file.filename.endswith('.csv') else '.xlsx'

    file_path = os.path.join(RAW_DIR, f"{dataset_id}{ext}")

    with open(file_path, "wb") as f:
        f.write(contents)

    columns = df.columns.tolist()

    # Auto-detect target column (last column is a common convention)
    probable_target = columns[-1]

    # Determine task type heuristically
    unique_vals = df[probable_target].nunique()
    is_numeric = pd.api.types.is_numeric_dtype(df[probable_target])

    if not is_numeric or unique_vals <= 10:
        task_type = "Classification"
    else:
        task_type = "Regression"

    # Type awareness for UI to show warnings
    type_summary = {}
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            type_summary[col] = "numeric"
        else:
            type_summary[col] = "categorical"

    return {
        "dataset_id": dataset_id,
        "filename": file.filename,
        "columns": columns,
        "recommended_target": probable_target,
        "recommended_task_type": task_type,
        "rows": len(df),
        "type_summary": type_summary
    }


@router.post("/train")
async def run_training(
    dataset_id: str = Form(...),
    target_column: str = Form(...),
    task_type: str = Form(...),
    perform_eda: bool = Form(False),
    pca_components: Optional[int] = Form(None),
    selected_features: Optional[str] = Form(None)  # JSON-encoded list of feature names
):
    """
    Validates the training request and delegates execution to the ML Service.
    The Backend reads the file, encodes it as base64, and sends it to ML Service.
    """
    dataset_id = os.path.basename(dataset_id)
    base_path = os.path.join(RAW_DIR, dataset_id)
    raw_path = None
    for ext in ['.csv', '.xlsx', '.xls']:
        if os.path.exists(base_path + ext):
            raw_path = base_path + ext
            break

    if not raw_path:
        raise HTTPException(status_code=404, detail="Dataset not found or session expired. Please re-upload.")

    try:
        df = _read_dataset(raw_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read stored dataset: {e}")

    if len(df) < 20:
        raise HTTPException(status_code=400, detail="Dataset must have at least 20 rows for training.")

    # Parse optional feature selection
    feature_cols = None
    if selected_features:
        try:
            feature_cols = json.loads(selected_features)
        except Exception:
            pass

    # Encode dataset as base64 for ML Service
    try:
        dataset_b64 = _encode_dataset_b64(raw_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to prepare dataset for ML Service: {e}")

    # Build ML Service request payload
    ml_payload = {
        "dataset_b64": dataset_b64,
        "target_column": target_column,
        "task_type": task_type,
        "perform_eda": perform_eda,
        "pca_components": pca_components,
        "selected_features": feature_cols
    }

    ml_url = f"{_get_ml_service_url()}/train/run"

    try:
        async with httpx.AsyncClient(timeout=300.0) as client:  # 5 min timeout for training
            resp = await client.post(ml_url, json=ml_payload)

        if resp.status_code == 200:
            try:
                return resp.json()
            except Exception:
                raise HTTPException(status_code=500, detail="Invalid JSON response from ML Service")
        else:
            try:
                error_detail = resp.json().get("detail", resp.text)
            except Exception:
                if resp.status_code in [502, 503, 504]:
                    error_detail = "ML Service is waking up from idle sleep. Please wait 30 seconds and retry."
                else:
                    error_detail = resp.text or f"ML Service returned status {resp.status_code}"
            raise HTTPException(status_code=resp.status_code, detail=error_detail)

    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="ML Service is waking up or unavailable. Please retry in 30 seconds."
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=408,
            detail="ML training request timed out. The dataset may be too large."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to communicate with ML Service: {str(e)}")


@router.post("/cluster")
async def run_clustering(
    dataset_id: str = Form(...),
    algorithm: str = Form("kmeans"),
    n_clusters: int = Form(3),
    pca_components: Optional[int] = Form(None)
):
    """
    Dedicated clustering endpoint. Delegates to ML Service /train/cluster.
    """
    dataset_id = os.path.basename(dataset_id)
    base_path = os.path.join(RAW_DIR, dataset_id)
    raw_path = None
    for ext in ['.csv', '.xlsx', '.xls']:
        if os.path.exists(base_path + ext):
            raw_path = base_path + ext
            break

    if not raw_path:
        raise HTTPException(status_code=404, detail="Dataset not found or session expired.")

    # Encode dataset as base64 for ML Service
    try:
        dataset_b64 = _encode_dataset_b64(raw_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to prepare dataset for ML Service: {e}")

    ml_payload = {
        "dataset_b64": dataset_b64,
        "algorithm": algorithm,
        "n_clusters": n_clusters,
        "pca_components": pca_components
    }

    ml_url = f"{_get_ml_service_url()}/train/cluster"

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(ml_url, json=ml_payload)

        if resp.status_code == 200:
            return resp.json()
        else:
            error_detail = resp.json().get("detail", f"ML Service returned status {resp.status_code}")
            raise HTTPException(status_code=resp.status_code, detail=error_detail)

    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="ML Service is unavailable. Please ensure the ML Service is running."
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Clustering request timed out.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to communicate with ML Service: {str(e)}")
