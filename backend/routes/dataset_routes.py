from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import pandas as pd
import io

from models import GenerateDatasetRequest, DatasetPreviewRequest
from services import gemini_service, dataset_formatter

router = APIRouter()

@router.post("")
async def generate_dataset(request: GenerateDatasetRequest):
    """
    Generates a synthetic dataset using Gemini AI.
    Returns both the raw CSV and a JSON representation.
    """
    try:
        # Generate raw CSV text via Gemini
        csv_text = gemini_service.generate_synthetic_data(
            dataset_name=request.dataset_name,
            columns=request.columns,
            rows=request.rows
        )
        
        # Format the CSV to JSON
        json_data, df = dataset_formatter.format_csv_to_json(csv_text)
        
        return JSONResponse(content={
            "message": "Dataset generated successfully",
            "csv": csv_text,
            "json": json_data
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/preview")
async def preview_dataset(request: DatasetPreviewRequest):
    """
    Accepts a raw CSV string and returns the first 10 rows as JSON for preview.
    """
    try:
        df = pd.read_csv(io.StringIO(request.csv_data))
        preview_data = dataset_formatter.get_preview(df, num_rows=10)
        return {"preview": preview_data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to generate preview: {str(e)}")

import os

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
RAW_DIR = os.path.join(DATA_DIR, "raw")

@router.get("/profile/{dataset_id}")
async def profile_dataset(dataset_id: str):
    """
    Reads a raw dataset via its UUID and returns a full Pandas profiling report 
    along with a Gemini-generated semantic understanding component.
    """
    dataset_id = os.path.basename(dataset_id)
    file_path = os.path.join(RAW_DIR, f"{dataset_id}.csv")
    if not os.path.exists(file_path):
        # Fallback check for excel
        file_path = os.path.join(RAW_DIR, f"{dataset_id}.xlsx")
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Dataset not found for profiling.")
            
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path, nrows=50000) # Read max 50k rows to prevent memory explosion during profiling
        else:
            df = pd.read_excel(file_path, nrows=50000)
            
        rows, cols = df.shape
        size_bytes = os.path.getsize(file_path)
        size_mb = size_bytes / (1024 * 1024)
        
        # Calculate real memory usage from Pandas DataFrame
        memory_usage_bytes = df.memory_usage(deep=True).sum()
        memory_usage_mb = memory_usage_bytes / (1024 * 1024)

        col_stats = {}
        for col in df.columns:
            series = df[col]
            missing_count = series.isna().sum()
            missing_pct = float(missing_count / rows) * 100 if rows > 0 else 0
            unique_count = series.nunique()
            dtype_str = str(series.dtype)
            
            # Grab a safe, non-null sample 
            valid_samples = series.dropna()
            sample_value = str(valid_samples.iloc[0]) if not valid_samples.empty else "N/A"
            if len(sample_value) > 30:
                sample_value = sample_value[:27] + "..."

            col_stats[col] = {
                "dtype": dtype_str,
                "missing_pct": round(missing_pct, 1),
                "unique_count": int(unique_count),
                "sample": sample_value
            }
            
        profile_json = {
            "dataset_id": dataset_id,
            "rows": int(rows),
            "columns": int(cols),
            "file_size_mb": round(size_mb, 2),
            "memory_usage_mb": round(memory_usage_mb, 2),
            "column_stats": col_stats
        }
        
        # Invoke AI Summary
        semantic_summary_res = gemini_service.generate_dataset_summary(profile_json)
        semantic_summary = semantic_summary_res.get("ai_insights") if isinstance(semantic_summary_res, dict) else semantic_summary_res
        if not semantic_summary:
            semantic_summary = "AI insights temporarily unavailable due to API limits."
        
        profile_json["ai_summary"] = semantic_summary
        
        return JSONResponse(content={"profile": profile_json})
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Profiling error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to profile dataset: {str(e)}")
