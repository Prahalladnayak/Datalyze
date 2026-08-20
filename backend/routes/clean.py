import os
import uuid
import pandas as pd
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from models import CleanRequest
from services import clean_service, dataset_formatter

router = APIRouter()

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
RAW_DIR = os.path.join(DATA_DIR, "raw")
CLEANED_DIR = os.path.join(DATA_DIR, "cleaned")

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(CLEANED_DIR, exist_ok=True)

@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """
    Uploads a dataset for cleaning, saves it, and returns initial summary.
    """
    if not (file.filename.endswith('.csv') or file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported.")
        
    dataset_id = str(uuid.uuid4())
    _, ext = os.path.splitext(file.filename)
    # Save the extension as part of the filename so we know what to read later
    file_path = os.path.join(RAW_DIR, f"{dataset_id}{ext}")
    
    try:
        content = await file.read()
        if len(content) > 25 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Dataset file too large. Maximum size allowed is 25MB.")
        with open(file_path, "wb") as f:
            f.write(content)
            
        if ext == '.csv':
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        summary = clean_service.analyze_dataset(df)
        preview = dataset_formatter.get_preview(df, 50)
        
        return {
            "dataset_id": dataset_id,
            "ext": ext,
            "filename": file.filename,
            "summary": summary,
            "preview": preview,
            "column_types": clean_service.detect_column_types(df)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process dataset: {str(e)}")

@router.get("/profile/{dataset_id}")
def get_column_profile(dataset_id: str):
    """
    Returns auto-detected column type profile for a previously uploaded dataset.
    Used by the frontend for smart cleaning recommendations.
    """
    dataset_id = os.path.basename(dataset_id)
    base_path = os.path.join(RAW_DIR, dataset_id)
    raw_path = None
    for ext in ['.csv', '.xlsx', '.xls']:
        if os.path.exists(base_path + ext):
            raw_path = base_path + ext
            break
    if not raw_path:
        raise HTTPException(status_code=404, detail="Dataset not found. Please upload again.")
    try:
        if raw_path.endswith('.csv'):
            df = pd.read_csv(raw_path)
        else:
            df = pd.read_excel(raw_path)
        return {"column_types": clean_service.detect_column_types(df)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to profile dataset: {str(e)}")

@router.post("/apply")
def apply_cleaning(request: CleanRequest):
    """
    Applies cleaning configurations to an uploaded dataset.
    """
    sanitized_id = os.path.basename(request.dataset_id)
    base_path = os.path.join(RAW_DIR, sanitized_id)
    raw_path = None
    for ext in ['.csv', '.xlsx', '.xls']:
        if os.path.exists(base_path + ext):
            raw_path = base_path + ext
            break

    if not raw_path:
        raise HTTPException(status_code=404, detail="Dataset not found. Please upload again.")
        
    try:
        if raw_path.endswith('.csv'):
            df_raw = pd.read_csv(raw_path)
        else:
            df_raw = pd.read_excel(raw_path)
            
        summary_before = clean_service.analyze_dataset(df_raw)
        
        df_clean, nlp_report = clean_service.apply_cleaning(df_raw, request.dict())
        summary_after = clean_service.analyze_dataset(df_clean)
        
        # Only save cleaned file if NLP cleaning passed (or was not applied)
        nlp_ok = nlp_report.get("status") in ("success", "skipped")
        download_url = None
        
        if nlp_ok:
            clean_path = os.path.join(CLEANED_DIR, f"{sanitized_id}.csv")
            df_clean.to_csv(clean_path, index=False)
            download_url = f"/api/clean/download/{sanitized_id}"
        
        preview = dataset_formatter.get_preview(df_clean, 50)
        
        return {
            "message": "Dataset cleaned successfully." if nlp_ok else "Cleaning applied but NLP transformation issues were detected.",
            "dataset_id": sanitized_id,
            "report": {
                "before": summary_before,
                "after": summary_after
            },
            "nlp_report": nlp_report,
            "preview": preview,
            "download_url": download_url
        }
    except HTTPException:
        raise
    except Exception as e:
        print("Cleaning Error:", e)
        raise HTTPException(status_code=500, detail=f"Failed to clean dataset: {str(e)}")

@router.get("/download/{dataset_id}")
async def download_cleaned_dataset(dataset_id: str):
    """
    Downloads the fully cleaned dataset.
    """
    dataset_id = os.path.basename(dataset_id)
    file_path = os.path.join(CLEANED_DIR, f"{dataset_id}.csv")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Cleaned dataset not found.")
        
    return FileResponse(
        path=file_path, 
        filename=f"cleaned_dataset_{dataset_id[:8]}.csv", 
        media_type='text/csv',
        headers={"Content-Disposition": f"attachment; filename=cleaned_dataset_{dataset_id[:8]}.csv"}
    )
