"""
ml-service/routes/train.py

REST API endpoints for supervised learning and clustering.

Endpoints:
  POST /train/run        — Train classification or regression models
  POST /train/cluster    — Train clustering models

The Backend calls these endpoints. Dataset is passed as base64-encoded CSV
in the request body (no shared filesystem required).
"""

import base64
import io
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import pandas as pd

from services.model_service import train_and_evaluate, train_clustering

router = APIRouter()


class TrainRequest(BaseModel):
    """
    Training request — dataset sent as base64-encoded CSV string.
    Backend reads the file from disk and encodes it before forwarding here.
    """
    dataset_b64: str          # base64-encoded CSV content
    target_column: str
    task_type: str            # "classification", "regression", "clustering"
    perform_eda: bool = False
    pca_components: Optional[int] = None
    selected_features: Optional[List[str]] = None


class ClusterRequest(BaseModel):
    """
    Dedicated clustering request.
    """
    dataset_b64: str          # base64-encoded CSV content
    algorithm: str = "kmeans" # "kmeans", "dbscan", "agglomerative"
    n_clusters: int = 3
    pca_components: Optional[int] = None


def decode_dataframe(dataset_b64: str) -> pd.DataFrame:
    """Decode a base64 CSV string into a pandas DataFrame."""
    try:
        csv_bytes = base64.b64decode(dataset_b64)
        return pd.read_csv(io.BytesIO(csv_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode dataset: {str(e)}")


@router.post("/run")
def run_training(body: TrainRequest):
    """
    Executes the training loop.
    For Classification and Regression: delegates to train_and_evaluate.
    For Clustering: delegates to train_clustering (no target column needed).
    """
    try:
        df = decode_dataframe(body.dataset_b64)
    except HTTPException:
        raise

    if len(df) < 20:
        raise HTTPException(
            status_code=400,
            detail="Dataset must have at least 20 rows for training."
        )

    task_lower = body.task_type.lower()

    if task_lower == "clustering":
        algorithm = body.target_column if body.target_column in ["kmeans", "dbscan", "agglomerative"] else "kmeans"
        df_cluster = df[body.selected_features] if body.selected_features else df
        try:
            results = train_clustering(df_cluster, algorithm=algorithm, n_clusters=3, pca_components=body.pca_components)
            return results
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")
    else:
        if body.target_column not in df.columns:
            raise HTTPException(
                status_code=400,
                detail=f"Target column '{body.target_column}' does not exist in dataset."
            )

        valid_target_series = df[body.target_column].dropna()
        if valid_target_series.empty:
            raise HTTPException(
                status_code=400,
                detail=f"Target column '{body.target_column}' cannot be empty or contain only missing values."
            )

        if task_lower == "classification":
            unique_classes = valid_target_series.nunique()
            if unique_classes < 2:
                raise HTTPException(
                    status_code=400,
                    detail=f"Target column '{body.target_column}' must have at least 2 distinct classes for classification. Found {unique_classes}."
                )
            if unique_classes > 50:
                raise HTTPException(
                    status_code=400,
                    detail=f"Target column '{body.target_column}' has too many classes ({unique_classes}) for classification. Maximum allowed is 50."
                )
        elif task_lower == "regression":
            if not pd.api.types.is_numeric_dtype(df[body.target_column]):
                raise HTTPException(
                    status_code=400,
                    detail=f"Target column '{body.target_column}' must be numeric for regression."
                )

        # Optionally subset to selected features + target
        if body.selected_features:
            keep_cols = [c for c in body.selected_features if c in df.columns and c != body.target_column] + [body.target_column]
            df = df[keep_cols]

        try:
            results = train_and_evaluate(df, body.target_column, body.task_type, body.perform_eda)
            return results
        except HTTPException:
            raise
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Modeling failed: {str(e)}")


@router.post("/cluster")
def run_clustering(body: ClusterRequest):
    """
    Dedicated clustering endpoint. Accepts explicit algorithm and n_clusters params.
    """
    try:
        df = decode_dataframe(body.dataset_b64)
    except HTTPException:
        raise

    try:
        results = train_clustering(
            df,
            algorithm=body.algorithm,
            n_clusters=body.n_clusters,
            pca_components=body.pca_components
        )
        return results
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")
