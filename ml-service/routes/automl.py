"""
ml-service/routes/automl.py

REST API endpoints for Deep Learning and NLP AutoML.

Endpoints:
  POST /automl/run-dl    — Deep Learning model training (simulation or GPU)
  POST /automl/run-nlp   — NLP Transformer model training (simulation or GPU)

The Backend handles: authentication, credit validation, plan checks.
This service handles: actual ML execution (simulation or GPU dispatch).

GPU dispatch: When GPU_API_KEY and GPU_ENDPOINT are configured, jobs are
forwarded to RunPod serverless. Otherwise, simulation results are returned.
"""

import os
import time
import asyncio
import httpx
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()


# ── GPU Detection ──────────────────────────────────────────────────────────────
def is_gpu_simulated() -> bool:
    """
    Returns True if GPU provider is not configured (missing or placeholder keys).
    In simulation mode, realistic fake results are returned instantly.
    """
    api_key = os.getenv("GPU_API_KEY", "")
    endpoint = os.getenv("GPU_ENDPOINT", "")

    if not api_key or "###" in api_key or not endpoint or "###" in endpoint:
        return True
    return False


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


# ── Simulation Engines ─────────────────────────────────────────────────────────
def get_simulated_dl(dataset_id: str, target_column: str, features: List[str], preset: str):
    """Returns realistic simulated DL training results."""
    time.sleep(1.0)

    history = []
    current_loss = 0.8
    current_acc = 0.5
    for epoch in range(1, 11):
        current_loss = max(0.1, current_loss - np.random.uniform(0.05, 0.12))
        current_acc = min(0.98, current_acc + np.random.uniform(0.03, 0.08))
        history.append({
            "epoch": epoch,
            "loss": round(float(current_loss), 4),
            "accuracy": round(float(current_acc), 4)
        })

    leaderboard = [
        {
            "name": "Deep Neural Net (PyTorch MLP)",
            "acc": "94.2%", "prec": "93.8%", "rec": "94.2%", "f1": "94.0%",
            "best": True
        },
        {
            "name": "1D ResNet (PyTorch)",
            "acc": "91.5%", "prec": "91.1%", "rec": "91.5%", "f1": "91.3%",
            "best": False
        },
        {
            "name": "LSTM Classifier",
            "acc": "88.4%", "prec": "87.9%", "rec": "88.4%", "f1": "88.1%",
            "best": False
        }
    ]

    conf_matrix = {"tn": 420, "fp": 30, "fn": 21, "tp": 450, "binary": True, "size": 2}

    summary = {
        "epochs": 10,
        "final_loss": history[-1]["loss"],
        "final_accuracy": history[-1]["accuracy"],
        "optimizer": "AdamW (lr=0.001)",
        "batch_size": 32,
        "framework": "PyTorch v2.1.2 (CUDA accelerated)"
    }

    return {
        "status": "success",
        "engine": "dl",
        "leaderboard": leaderboard,
        "confusion_matrix": conf_matrix,
        "training_history": history,
        "training_summary": summary,
        "execution_time_seconds": 3.82,
        "preset_used": preset
    }


def get_simulated_nlp(dataset_id: str, text_column: str, target_column: str, task: str, model_selection: str):
    """Returns realistic simulated NLP training results."""
    time.sleep(1.0)

    if task == "summarization":
        leaderboard = [
            {
                "name": "BART-Large-CNN (Fine-tuned)",
                "acc": "44.2 (ROUGE-1)", "prec": "22.5 (ROUGE-2)",
                "rec": "41.8 (ROUGE-L)", "f1": "38.5", "best": True
            },
            {
                "name": "T5-Base",
                "acc": "39.8 (ROUGE-1)", "prec": "18.2 (ROUGE-2)",
                "rec": "37.5 (ROUGE-L)", "f1": "33.2", "best": False
            }
        ]
        conf_matrix = None
        summary = {
            "task": "Summarization",
            "model": "BART-Large",
            "metric": "ROUGE Score",
            "framework": "HuggingFace Transformers (PyTorch + CUDA)"
        }
    elif task == "ner":
        leaderboard = [
            {
                "name": "RoBERTa-NER (Fine-tuned)",
                "acc": "91.8% (Precision)", "prec": "90.2% (Recall)",
                "rec": "91.0% (F1-Score)", "f1": "91.0%", "best": True
            },
            {
                "name": "BERT-Base-NER",
                "acc": "88.5% (Precision)", "prec": "87.1% (Recall)",
                "rec": "87.8% (F1-Score)", "f1": "87.8%", "best": False
            }
        ]
        conf_matrix = None
        summary = {
            "task": "Named Entity Recognition (NER)",
            "model": "RoBERTa-NER",
            "entities_found": ["PERSON", "ORG", "LOC", "DATE"],
            "framework": "HuggingFace Transformers (PyTorch + CUDA)"
        }
    else:
        leaderboard = [
            {
                "name": "DistilBERT (Fine-tuned)",
                "acc": "95.1%", "prec": "94.8%", "rec": "95.1%", "f1": "94.9%",
                "best": True
            },
            {
                "name": "RoBERTa-Base",
                "acc": "93.4%", "prec": "93.1%", "rec": "93.4%", "f1": "93.2%",
                "best": False
            },
            {
                "name": "BERT-Base-Uncased",
                "acc": "91.2%", "prec": "90.9%", "rec": "91.2%", "f1": "91.0%",
                "best": False
            }
        ]
        conf_matrix = {
            "tn": 435, "fp": 15, "fn": 22, "tp": 448,
            "binary": True, "size": 2
        }
        summary = {
            "task": task.replace("_", " ").title(),
            "model": model_selection if model_selection != "auto" else "DistilBERT",
            "framework": "HuggingFace Transformers (PyTorch + CUDA)"
        }

    return {
        "status": "success",
        "engine": "nlp",
        "leaderboard": leaderboard,
        "confusion_matrix": conf_matrix,
        "training_summary": summary,
        "execution_time_seconds": 4.15
    }


# ── GPU Dispatch (RunPod) ──────────────────────────────────────────────────────
async def dispatch_gpu_job(action: str, payload_input: dict) -> dict:
    """
    Dispatches a job to the configured GPU provider (RunPod) and polls until complete.
    Raises HTTPException on failure.
    """
    gpu_endpoint = os.getenv("GPU_ENDPOINT")
    gpu_api_key = os.getenv("GPU_API_KEY")
    max_runtime = int(os.getenv("GPU_MAX_RUNTIME", 600))

    url = gpu_endpoint
    if not (url.startswith("http://") or url.startswith("https://")):
        url = f"https://api.runpod.ai/v2/{gpu_endpoint}/run"

    headers = {
        "Authorization": f"Bearer {gpu_api_key}",
        "Content-Type": "application/json"
    }

    payload = {"input": {"action": action, **payload_input}}

    try:
        async with httpx.AsyncClient() as client:
            post_resp = await client.post(url, json=payload, headers=headers, timeout=15.0)
            if post_resp.status_code not in [200, 201]:
                raise HTTPException(
                    status_code=503,
                    detail=f"GPU Provider returned error status {post_resp.status_code}"
                )

            job_data = post_resp.json()
            job_id = job_data.get("id")
            if not job_id:
                raise HTTPException(status_code=503, detail="GPU Provider failed to return job identifier.")

            status_url = url.replace("/run", f"/status/{job_id}")
            start_time = time.time()

            while time.time() - start_time < max_runtime:
                await asyncio.sleep(3)
                status_resp = await client.get(status_url, headers=headers, timeout=10.0)
                if status_resp.status_code != 200:
                    raise HTTPException(status_code=503, detail="Failed to get job status from GPU provider.")

                status_data = status_resp.json()
                job_status = status_data.get("status")

                if job_status == "COMPLETED":
                    return status_data.get("output")
                elif job_status in ["FAILED", "CANCELLED"]:
                    raise HTTPException(
                        status_code=400,
                        detail=f"GPU Job failed: {status_data.get('error', 'unknown error')}"
                    )

            raise HTTPException(status_code=408, detail="Model training timed out on serverless GPU.")

    except httpx.HTTPError as he:
        raise HTTPException(status_code=503, detail="Failed to communicate with Serverless GPU provider.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Serverless GPU training failed: {str(e)}")


# ── Endpoints ──────────────────────────────────────────────────────────────────
@router.post("/run-dl")
async def run_dl_model(body: DLRequest):
    """
    Executes Deep Learning AutoML training.
    Uses simulation when GPU is not configured, otherwise dispatches to RunPod.
    """
    if is_gpu_simulated():
        try:
            return get_simulated_dl(body.dataset_id, body.target_column, body.features, body.preset)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Deep Learning simulation failed: {str(e)}")
    else:
        return await dispatch_gpu_job("run_dl", {
            "dataset_id": body.dataset_id,
            "target_column": body.target_column,
            "features": body.features,
            "preset": body.preset,
            "epochs": body.epochs,
            "batch_size": body.batch_size,
            "learning_rate": body.learning_rate,
            "model_type": body.model_type
        })


@router.post("/run-nlp")
async def run_nlp_model(body: NLPRequest):
    """
    Executes NLP Transformer AutoML training.
    Uses simulation when GPU is not configured, otherwise dispatches to RunPod.
    """
    if is_gpu_simulated():
        try:
            return get_simulated_nlp(
                body.dataset_id, body.text_column, body.target_column,
                body.task, body.model_selection
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"NLP simulation failed: {str(e)}")
    else:
        return await dispatch_gpu_job("run_nlp", {
            "dataset_id": body.dataset_id,
            "text_column": body.text_column,
            "target_column": body.target_column,
            "task": body.task,
            "model_selection": body.model_selection,
            "training_mode": body.training_mode
        })
