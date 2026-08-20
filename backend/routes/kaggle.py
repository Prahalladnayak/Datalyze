import os
import glob
import pandas as pd
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from typing import Optional

from services import kaggle_service

router = APIRouter()

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
KAGGLE_DIR = os.path.join(DATA_DIR, "kaggle")
os.makedirs(KAGGLE_DIR, exist_ok=True)

@router.get("/search")
def search_datasets(query: str, topic: Optional[str] = None):
    """
    Search Kaggle for datasets using the provided query.
    """
    try:
        datasets = kaggle_service.search_kaggle_datasets(query=query)
        if topic:
            datasets = [d for d in datasets if topic.lower() in d['name'].lower() or topic.lower() in d['description'].lower()]
        return datasets
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{username}/{dataset_name}")
def download_dataset(username: str, dataset_name: str):
    """
    Downloads a dataset from Kaggle and returns the largest CSV file within it.
    Reference must be in `username/dataset_name` format.
    """
    dataset_ref = f"{username}/{dataset_name}"
    download_dir = os.path.join(KAGGLE_DIR, dataset_name)
    
    try:
        os.makedirs(download_dir, exist_ok=True)
        kaggle_service.download_kaggle_dataset(dataset_ref, download_path=download_dir)
        
        csv_files = glob.glob(f"{download_dir}/**/*.csv", recursive=True)
        if not csv_files:
            raise Exception("No CSV files found in the downloaded dataset.")
        
        # Return the largest CSV file found
        largest_csv = max(csv_files, key=os.path.getsize)
        filename = os.path.basename(largest_csv)
        
        # Adding correct headers for browser download
        return FileResponse(
            path=largest_csv, 
            filename=filename, 
            media_type='text/csv',
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/preview/{username}/{dataset_name}")
def preview_dataset(username: str, dataset_name: str, limit: int = 50):
    """
    Fetches the first N rows of a Kaggle dataset CSV for preview.
    """
    dataset_ref = f"{username}/{dataset_name}"
    download_dir = os.path.join(KAGGLE_DIR, dataset_name)
    
    try:
        os.makedirs(download_dir, exist_ok=True)
        kaggle_service.download_kaggle_dataset(dataset_ref, download_path=download_dir)
        
        csv_files = glob.glob(f"{download_dir}/**/*.csv", recursive=True)
        if not csv_files:
            raise Exception("No CSV files found in the downloaded dataset.")
        
        largest_csv = max(csv_files, key=os.path.getsize)
        
        # Parse first N rows quickly
        df = pd.read_csv(largest_csv, nrows=limit)
        
        # Safely convert to JSON-serializable dictionaries handling NaNs and Numpy types
        df_json = json.loads(df.to_json(orient="records", date_format="iso"))
        
        return JSONResponse(content={
            "metadata": {
                "columns": list(df.columns),
                "filename": os.path.basename(largest_csv)
            },
            "data": df_json
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
