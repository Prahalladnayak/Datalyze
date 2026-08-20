import os
import uuid
import pandas as pd
import re
from fastapi import APIRouter, File, UploadFile, HTTPException
from services import gemini_service

router = APIRouter()

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
RAW_DIR = os.path.join(DATA_DIR, "raw")
os.makedirs(RAW_DIR, exist_ok=True)

@router.post("/analyze")
async def analyze_dataset(file: UploadFile = File(...)):
    """
    Uploads a dataset and performs comprehensive pandas analysis 
    for Dataset Understanding.
    """
    if not (file.filename.endswith('.csv') or file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported.")
        
    dataset_id = str(uuid.uuid4())
    _, ext = os.path.splitext(file.filename)
    file_path = os.path.join(RAW_DIR, f"{dataset_id}{ext}")
    
    try:
        content = await file.read()
        if len(content) > 25 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Dataset file too large. Maximum size allowed is 25MB.")
        with open(file_path, "wb") as f:
            f.write(content)
            
        if ext == '.csv':
            # Handle potential encoding issues with pandas
            try:
                df = pd.read_csv(file_path)
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding='latin1')
        else:
            df = pd.read_excel(file_path)
            
        rows, cols = df.shape
        memory_usage_bytes = df.memory_usage(deep=True).sum()
        
        def format_size(size_bytes):
            for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
                if size_bytes < 1024.0:
                    return f"{size_bytes:.2f} {unit}"
                size_bytes /= 1024.0
            return f"{size_bytes:.2f} PB"
            
        memory_usage_str = format_size(memory_usage_bytes)
        file_size_str = format_size(os.path.getsize(file_path))
        
        # Column Dictionary & Statistical Summary
        column_dictionary = []
        statistical_summary = {
            "numeric": {},
            "categorical": {}
        }
        
        numeric_df = df.select_dtypes(include=['number'])
        if not numeric_df.empty:
            statistical_summary["numeric"] = numeric_df.describe().to_dict()
            
        categorical_df = df.select_dtypes(exclude=['number'])
        if not categorical_df.empty:
            for col in categorical_df.columns:
                # Get top 5 value counts for categorical
                val_counts = categorical_df[col].value_counts().head(5).to_dict()
                # Convert keys to strings to ensure JSON serialization
                statistical_summary["categorical"][col] = {str(k): v for k, v in val_counts.items()}

        profile_columns = {}
        for col in df.columns:
            missing_count = int(df[col].isnull().sum())
            missing_percentage = round((missing_count / rows) * 100, 2) if rows > 0 else 0
            unique_count = int(df[col].nunique())
            
            # Get up to 3 non-null examples
            examples = df[col].dropna().head(3).tolist()
            
            dtype_str = str(df[col].dtype)
            
            col_info = {
                "name": col,
                "type": dtype_str,
                "missing_count": missing_count,
                "missing_percentage": missing_percentage,
                "unique_count": unique_count,
                "examples": examples
            }
            column_dictionary.append(col_info)
            profile_columns[col] = dtype_str # For Gemini

        # Prepare payload for Gemini prompt
        profile_json = {
            "rows": rows,
            "columns": cols,
            "column_stats": profile_columns
        }
        
        # Generate Insights for Columns
        column_insights = gemini_service.generate_column_insights(profile_columns)
        
        # Add insights to dictionary
        for col_info in column_dictionary:
            col_name = col_info["name"]
            col_info["insight"] = column_insights.get(col_name, "Column represents data with no explicit semantic meaning")

        # ── NEW: Head Preview (first 5–8 rows) ──
        head_df = df.head(8).fillna("")
        # Ensure JSON-serializable values
        head_preview = head_df.astype(str).to_dict(orient="records")

        # ── NEW: Detect text-heavy columns ──
        detected_text_cols = []
        for col in df.select_dtypes(include=["object"]).columns:
            sample = df[col].dropna().astype(str)
            if len(sample) > 0:
                avg_words = sample.apply(lambda x: len(x.split())).mean()
                if avg_words > 2:
                    detected_text_cols.append(col)

        # ── NEW: Text quality warning ──
        text_quality_warning = None
        if detected_text_cols:
            # Check for common noisy patterns in the first 200 rows
            noisy_indicators = [r'@\w+', r'https?://', r'&[a-z]+;', r'\bRT\b', r'[!?]{2,}', r'\d{5,}']
            noisy_cols = []
            for col in detected_text_cols:
                sample_text = " ".join(df[col].dropna().astype(str).head(200).tolist())
                if any(re.search(pat, sample_text) for pat in noisy_indicators):
                    noisy_cols.append(col)
            if noisy_cols:
                text_quality_warning = f"⚠️ Column(s) {', '.join(noisy_cols)} contain noisy text (URLs, @mentions, HTML entities, or excessive punctuation). Apply NLP cleaning before modeling."

        # ── Data Quality Snapshot Stats (must be computed BEFORE ai_summary) ──
        total_cells = rows * cols
        total_missing = int(df.isnull().sum().sum())
        missing_overall_pct = round((total_missing / total_cells) * 100, 2) if total_cells > 0 else 0.0
        numeric_cols_count = len(df.select_dtypes(include=['number']).columns)
        categorical_cols_count = cols - numeric_cols_count
        numeric_pct = round((numeric_cols_count / cols) * 100, 1) if cols > 0 else 0.0
        categorical_pct = round((categorical_cols_count / cols) * 100, 1) if cols > 0 else 0.0
        duplicate_rows_count = int(df.duplicated().sum())

    # ── AI Dataset Insights ──
        ai_res = gemini_service.generate_dataset_summary(profile_json)
        
        if isinstance(ai_res, dict):
            ai_summary_text = ai_res.get("ai_insights")
            llm_status = ai_res.get("llm_status", "success")
        else:
            # Fallback if old version of gemini_service returns string
            ai_summary_text = ai_res
            llm_status = "success"
        
        # Append explicit data health warnings
        if ai_summary_text:
            if text_quality_warning:
                ai_summary_text += f"\n\n{text_quality_warning}"
            if missing_overall_pct > 10:
                ai_summary_text += f"\n⚠️ Note: {missing_overall_pct}% of cells are missing values."
        
        return {
            "dataset_id": dataset_id,
            "filename": file.filename,
            "ext": ext,
            "overview": {
                "rows": rows,
                "columns": cols,
                "size": file_size_str,
                "missing_overall_pct": missing_overall_pct,
                "numeric_pct": numeric_pct,
                "categorical_pct": categorical_pct,
                "duplicate_rows": duplicate_rows_count
            },
            "column_dictionary": column_dictionary,
            "statistical_summary": statistical_summary,
            "head_preview": head_preview,
            "detected_text_cols": detected_text_cols,
            "text_quality_warning": text_quality_warning,
            "ai_insights": ai_summary_text,
            "llm_status": llm_status,
            "ai_summary": ai_summary_text, # Legacy compat
            "datascope_summary": None,
            "column_insights": column_insights
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze dataset: {str(e)}")

@router.get("/profile/{dataset_id}")
async def get_dataset_profile(dataset_id: str):
    """
    Retrieves the dataset from disk by dataset_id and returns the profiling struct
    expected by the frontend DatasetProfiler component.
    """
    dataset_id = os.path.basename(dataset_id)
    search_dirs = [
        RAW_DIR,
        os.path.join(DATA_DIR, "generated"),
        os.path.join(DATA_DIR, "cleaned")
    ]
    
    file_path = None
    ext = None
    for d in search_dirs:
        for possible_ext in ['.csv', '.xlsx', '.xls']:
            potential_path = os.path.join(d, f"{dataset_id}{possible_ext}")
            if os.path.exists(potential_path):
                file_path = potential_path
                ext = possible_ext
                break
        if file_path:
            break
            
    if not file_path:
        raise HTTPException(status_code=404, detail="Dataset not found or session expired. Please re-generate or re-upload.")
        
    try:
        if ext == '.csv':
            try:
                df = pd.read_csv(file_path)
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding='latin1')
        else:
            df = pd.read_excel(file_path)
            
        rows, cols = df.shape
        memory_usage_bytes = df.memory_usage(deep=True).sum()
        memory_usage_mb = round(memory_usage_bytes / (1024 * 1024), 2)
        file_size_mb = round(os.path.getsize(file_path) / (1024 * 1024), 2)
        
        profile_columns = {}
        column_stats = {}
        for col in df.columns:
            dtype_str = str(df[col].dtype)
            missing_count = int(df[col].isnull().sum())
            missing_percentage = round((missing_count / rows) * 100, 2) if rows > 0 else 0
            unique_count = int(df[col].nunique())
            examples = df[col].dropna().head(1).tolist()
            sample = str(examples[0]) if examples else ""
            
            column_stats[col] = {
                "dtype": dtype_str,
                "missing_pct": missing_percentage,
                "unique_count": unique_count,
                "sample": sample
            }
            profile_columns[col] = dtype_str
            
        profile_json = {
            "rows": rows,
            "columns": cols,
            "column_stats": profile_columns
        }
        
        # Generate AI Summary for the profiler
        ai_res = gemini_service.generate_dataset_summary(profile_json)
        ai_summary_text = ai_res.get("ai_insights") if isinstance(ai_res, dict) else ai_res
        if not ai_summary_text:
            ai_summary_text = "AI insights temporarily unavailable due to API limits."
        
        return {
            "profile": {
                "ai_summary": ai_summary_text,
                "rows": rows,
                "columns": cols,
                "file_size_mb": file_size_mb,
                "memory_usage_mb": memory_usage_mb,
                "column_stats": column_stats
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to profile dataset: {str(e)}")

@router.post("/xray")
async def process_xray(file: UploadFile = File(...)):
    """
    Uploads a dataset and provides Data X-Ray analysis.
    Returns 5 rows of data, shape, memory usage, AI column roles, and insights.
    """
    if not (file.filename.endswith('.csv') or file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported.")
        
    dataset_id = str(uuid.uuid4())
    _, ext = os.path.splitext(file.filename)
    file_path = os.path.join(RAW_DIR, f"{dataset_id}{ext}")
    
    try:
        content = await file.read()
        if len(content) > 25 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Dataset file too large. Maximum size allowed is 25MB.")
        with open(file_path, "wb") as f:
            f.write(content)
            
        if ext == '.csv':
            try:
                df = pd.read_csv(file_path)
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding='latin1')
        else:
            df = pd.read_excel(file_path)
            
        rows, cols = df.shape
        memory_usage_bytes = df.memory_usage(deep=True).sum()
        
        def format_size(size_bytes):
            for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
                if size_bytes < 1024.0:
                    return f"{size_bytes:.2f} {unit}"
                size_bytes /= 1024.0
            return f"{size_bytes:.2f} PB"
            
        memory_usage_str = format_size(memory_usage_bytes)
        file_type = ext.upper().replace('.', '')
        
        # Prepare 5 rows payload
        head_data = df.head(5).fillna("NaN").to_dict(orient="records")
        
        # Prepare stats for Gemini
        profile_columns = {}
        column_stats = {}
        for col in df.columns:
            dtype_str = str(df[col].dtype)
            missing_count = int(df[col].isnull().sum())
            missing_percentage = round((missing_count / rows) * 100, 2) if rows > 0 else 0
            unique_count = int(df[col].nunique())
            
            column_stats[col] = {
                "dtype": dtype_str,
                "missing_pct": missing_percentage,
                "unique_count": unique_count
            }
            profile_columns[col] = dtype_str
            
        profile_json = {
            "rows": rows,
            "columns": cols,
            "column_stats": profile_columns
        }
        
        # Call Gemini for roles and insights
        xray_ai = gemini_service.generate_xray_analysis(profile_json)
        
        # Merge AI roles into column_stats
        column_roles = xray_ai.get("column_roles", {})
        for col in column_stats:
            column_stats[col]["role"] = column_roles.get(col, "Feature")
            
        return {
            "dataset_id": dataset_id,
            "filename": file.filename,
            "shape": {"rows": rows, "columns": cols},
            "file_type": file_type,
            "memory_usage": memory_usage_str,
            "head_data": head_data,
            "column_stats": column_stats,
            "insights": xray_ai.get("insights", [])
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process Data X-Ray: {str(e)}")
