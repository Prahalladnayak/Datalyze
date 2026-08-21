"""
backend/routes/automl.py

API Gateway for AutoML (Deep Learning and NLP).

Backend responsibilities (this file):
  - JWT authentication
  - Plan validation (Pro/Ultra required)
  - Credit balance checks
  - Dataset file validation (column existence, type checks)
  - Credit deduction after successful training
  - Activity logging

ML Service responsibilities (delegated via HTTP):
  - DL simulation / RunPod GPU dispatch
  - NLP simulation / RunPod GPU dispatch

Communication: Backend → POST {ML_SERVICE_URL}/automl/run-dl | /automl/run-nlp
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional, List
import os
import httpx
import pandas as pd
import asyncpg

from database import get_connection
from routes.auth import get_current_user

router = APIRouter()

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
RAW_DIR = os.path.join(DATA_DIR, "raw")


def _get_ml_service_url() -> str:
    """Get ML Service URL from environment (allows runtime override)."""
    return os.getenv("ML_SERVICE_URL", "http://localhost:8001")


# ── Request Models ─────────────────────────────────────────────────────────────
class DLRequest(BaseModel):
    dataset_id: str
    target_column: str
    features: List[str]
    preset: str              # Auto, Fast, Balanced, Accurate
    epochs: Optional[int] = 10
    batch_size: Optional[int] = 32
    learning_rate: Optional[float] = 0.001
    model_type: Optional[str] = "FeedForward"


class NLPRequest(BaseModel):
    dataset_id: str
    text_column: str
    target_column: str
    task: str                # text_classification, sentiment_analysis, ner, summarization
    model_selection: str     # auto, distilbert, roberta, bert
    training_mode: str       # fast, standard, fine_tune


# ── ML Service Communication ───────────────────────────────────────────────────
async def _call_ml_service(endpoint: str, payload: dict) -> dict:
    """
    Forward a request to the ML Service and return the JSON result.
    Raises HTTPException on connection failure or error response.
    """
    ml_url = f"{_get_ml_service_url()}{endpoint}"

    try:
        async with httpx.AsyncClient(timeout=600.0) as client:  # 10 min for GPU jobs
            resp = await client.post(ml_url, json=payload)

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
            detail="ML training request timed out. The job may still be running on the GPU provider."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to communicate with ML Service: {str(e)}")


# ── AutoML DL Endpoint ─────────────────────────────────────────────────────────
@router.post("/run-dl")
async def run_dl_model(body: DLRequest, current_user: dict = Depends(get_current_user)):
    """
    Backend gateway for Deep Learning AutoML.
    1. Validates user plan & credits
    2. Validates dataset and columns
    3. Delegates execution to ML Service
    4. Deducts credits after success
    5. Returns ML Service results to Frontend
    """
    user_id = int(current_user["sub"])
    DL_COST = 60

    # ── Step 1: Validate user plan and credits ─────────────────────────────────
    try:
        async with get_connection() as conn:
            user = await conn.fetchrow("SELECT plan, credits FROM users WHERE id = $1", user_id)
    except Exception as e:
        print(f"[AutoML DL Error] Database query failed: {e}")
        raise HTTPException(status_code=503, detail="Database connection is temporarily unavailable.")

    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    plan = user["plan"]
    credits = user["credits"]

    if plan.lower() not in ["pro", "ultra"]:
        raise HTTPException(
            status_code=403,
            detail="Deep Learning AutoML features are restricted to Pro or Ultra subscription plans."
        )

    if credits < DL_COST:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Deep Learning AutoML requires {DL_COST} credits (you have {credits})."
        )

    # ── Step 2: Validate dataset and columns ───────────────────────────────────
    body.dataset_id = os.path.basename(body.dataset_id)
    base_path = os.path.join(RAW_DIR, body.dataset_id)
    raw_path = None
    for ext in ['.csv', '.xlsx', '.xls']:
        if os.path.exists(base_path + ext):
            raw_path = base_path + ext
            break

    if not raw_path:
        raise HTTPException(status_code=404, detail="Dataset not found or session expired. Please re-upload.")

    try:
        if raw_path.endswith('.csv'):
            df = pd.read_csv(raw_path)
        else:
            df = pd.read_excel(raw_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read dataset for validation: {str(e)}")

    if body.target_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{body.target_column}' does not exist in dataset.")

    valid_target_series = df[body.target_column].dropna()
    if valid_target_series.empty:
        raise HTTPException(status_code=400, detail=f"Target column '{body.target_column}' cannot be empty or contain only missing values.")

    missing_features = [f for f in body.features if f not in df.columns]
    if missing_features:
        raise HTTPException(status_code=400, detail=f"The following features do not exist in the dataset: {', '.join(missing_features)}")

    unique_vals = valid_target_series.nunique()
    is_numeric = pd.api.types.is_numeric_dtype(df[body.target_column])
    if not is_numeric or unique_vals <= 10:
        if unique_vals < 2:
            raise HTTPException(status_code=400, detail="Target column must have at least 2 distinct classes for classification.")
        if unique_vals > 50:
            raise HTTPException(status_code=400, detail="Target column has too many unique values (> 50) for classification.")
    else:
        if not is_numeric:
            raise HTTPException(status_code=400, detail="Target column for regression must be numeric.")

    # ── Step 3: Delegate to ML Service ─────────────────────────────────────────
    ml_payload = {
        "dataset_id": body.dataset_id,
        "target_column": body.target_column,
        "features": body.features,
        "preset": body.preset,
        "epochs": body.epochs,
        "batch_size": body.batch_size,
        "learning_rate": body.learning_rate,
        "model_type": body.model_type
    }

    results = await _call_ml_service("/automl/run-dl", ml_payload)

    # ── Step 4: Deduct credits (after successful training) ─────────────────────
    try:
        async with get_connection() as conn:
            async with conn.transaction():
                current_credits = await conn.fetchval("SELECT credits FROM users WHERE id = $1", user_id)
                if current_credits < DL_COST:
                    raise HTTPException(status_code=402, detail="Insufficient credits.")

                await conn.execute("UPDATE users SET credits = credits - $1 WHERE id = $2", DL_COST, user_id)
                filename = os.path.basename(raw_path)
                await conn.execute(
                    "INSERT INTO activity_logs (user_id, action, detail, credits_used) VALUES ($1, $2, $3, $4)",
                    user_id, "Build DL Model", f"Deep Learning AutoML executed on {filename}", DL_COST
                )
    except HTTPException:
        raise
    except Exception as db_err:
        print(f"[AutoML DL Error] Database transaction failed: {db_err}")
        raise HTTPException(
            status_code=500,
            detail="Model trained successfully but credit sync failed. Credits were not deducted."
        )

    return results


# ── AutoML NLP Endpoint ────────────────────────────────────────────────────────
@router.post("/run-nlp")
async def run_nlp_model(body: NLPRequest, current_user: dict = Depends(get_current_user)):
    """
    Backend gateway for NLP AutoML.
    1. Validates user plan & credits
    2. Validates dataset and columns
    3. Delegates execution to ML Service
    4. Deducts credits after success
    5. Returns ML Service results to Frontend
    """
    user_id = int(current_user["sub"])
    NLP_COST = 40

    # ── Step 1: Validate user plan and credits ─────────────────────────────────
    try:
        async with get_connection() as conn:
            user = await conn.fetchrow("SELECT plan, credits FROM users WHERE id = $1", user_id)
    except Exception as e:
        print(f"[AutoML NLP Error] Database query failed: {e}")
        raise HTTPException(status_code=503, detail="Database connection is temporarily unavailable.")

    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    plan = user["plan"]
    credits = user["credits"]

    if plan.lower() not in ["pro", "ultra"]:
        raise HTTPException(
            status_code=403,
            detail="NLP AutoML features are restricted to Pro or Ultra subscription plans."
        )

    if credits < NLP_COST:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. NLP AutoML requires {NLP_COST} credits (you have {credits})."
        )

    # ── Step 2: Validate dataset and columns ───────────────────────────────────
    body.dataset_id = os.path.basename(body.dataset_id)
    base_path = os.path.join(RAW_DIR, body.dataset_id)
    raw_path = None
    for ext in ['.csv', '.xlsx', '.xls']:
        if os.path.exists(base_path + ext):
            raw_path = base_path + ext
            break

    if not raw_path:
        raise HTTPException(status_code=404, detail="Dataset not found or session expired. Please re-upload.")

    try:
        if raw_path.endswith('.csv'):
            df = pd.read_csv(raw_path)
        else:
            df = pd.read_excel(raw_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read dataset for validation: {str(e)}")

    if body.text_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Text column '{body.text_column}' does not exist in dataset.")

    if body.task in ["text_classification", "sentiment_analysis", "ner"]:
        if not body.target_column:
            raise HTTPException(status_code=400, detail=f"Target column is required for task '{body.task}'.")
        if body.target_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Target column '{body.target_column}' does not exist in dataset.")

        valid_target_series = df[body.target_column].dropna()
        if valid_target_series.empty:
            raise HTTPException(status_code=400, detail=f"Target column '{body.target_column}' cannot be empty or contain only missing values.")

        if body.task in ["text_classification", "sentiment_analysis"]:
            unique_vals = valid_target_series.nunique()
            if unique_vals < 2:
                raise HTTPException(status_code=400, detail="Target column must have at least 2 distinct classes.")
            if unique_vals > 50:
                raise HTTPException(status_code=400, detail="Target column has too many unique values (> 50) for classification.")

    # ── Step 3: Delegate to ML Service ─────────────────────────────────────────
    ml_payload = {
        "dataset_id": body.dataset_id,
        "text_column": body.text_column,
        "target_column": body.target_column,
        "task": body.task,
        "model_selection": body.model_selection,
        "training_mode": body.training_mode
    }

    results = await _call_ml_service("/automl/run-nlp", ml_payload)

    # ── Step 4: Deduct credits (after successful training) ─────────────────────
    try:
        async with get_connection() as conn:
            async with conn.transaction():
                current_credits = await conn.fetchval("SELECT credits FROM users WHERE id = $1", user_id)
                if current_credits < NLP_COST:
                    raise HTTPException(status_code=402, detail="Insufficient credits.")

                await conn.execute("UPDATE users SET credits = credits - $1 WHERE id = $2", NLP_COST, user_id)
                filename = os.path.basename(raw_path)
                await conn.execute(
                    "INSERT INTO activity_logs (user_id, action, detail, credits_used) VALUES ($1, $2, $3, $4)",
                    user_id, "Build NLP Model", f"NLP Transformers AutoML executed on {filename}", NLP_COST
                )
    except HTTPException:
        raise
    except Exception as db_err:
        print(f"[AutoML NLP Error] Database transaction failed: {db_err}")
        raise HTTPException(
            status_code=500,
            detail="Model trained successfully but credit sync failed. Credits were not deducted."
        )

    return results
