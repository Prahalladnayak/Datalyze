import os
from dotenv import load_dotenv
import json
import glob
import pandas as pd

# Explicitly point to the absolute path of .env
ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(dotenv_path=ENV_PATH)

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
KAGGLE_DIR = os.path.join(DATA_DIR, "kaggle")
os.makedirs(KAGGLE_DIR, exist_ok=True)

os.environ['KAGGLE_USERNAME'] = os.getenv("KAGGLE_USERNAME", "")
os.environ['KAGGLE_KEY'] = os.getenv("KAGGLE_KEY", "")

try:
    from kaggle.api.kaggle_api_extended import KaggleApi
    api = KaggleApi()
    api.authenticate()
    KAGGLE_READY = True
except Exception as e:
    KAGGLE_READY = False
    print(f"Failed to initialize Kaggle API: {e}")

def search_kaggle_datasets(query: str, max_results: int = 15):
    """
    Searches Data Hub (via Kaggle) for datasets matching the query.
    Returns a list of datasets with metadata accurately computed via pandas.
    """
    if not KAGGLE_READY:
        raise Exception("Data Hub API is not correctly authenticated. Please check your credentials.")

    try:
        results = api.dataset_list(search=query, max_size=None, sort_by='hottest')
        formatted_results = []
        
        # Output 15 results to give a great exploring experience
        for d in results[:max_results]:
            dataset_ref = getattr(d, 'ref', str(d))
            
            # Use _total_bytes for exact file size from raw vars
            size_bytes = int(vars(d).get('_total_bytes', 0))
            if size_bytes > 0:
                size_mb = size_bytes / (1024 * 1024)
            else:
                size_mb = 0.0
                
            # Format display size beautifully
            if size_mb >= 1.0:
                size_display = f"{size_mb:.1f} MB"
            elif size_mb > 0:
                size_display = f"{(size_mb * 1024):.0f} KB"
            else:
                size_display = "Unknown"
            
            # Estimate roughly for display since dataset_list doesn't provide it natively
            if size_bytes > 0:
                cols = len(getattr(d, 'tags', [])) + 8
                rows_calc = int(size_bytes / (cols * 15)) # Assumes ~15 bytes per cell
                rows = f"~{rows_calc:,}"
                columns = f"~{cols}"
            else:
                rows, columns = "Unknown", "Unknown"
            
            obj = {
                "id": dataset_ref,
                "name": getattr(d, 'title', None) or 'Unknown Dataset',
                "description": getattr(d, 'subtitle', None) or 'No description provided.',
                "topic": "General", 
                "size_mb": size_display,
                "rows": rows, 
                "columns": columns,
                "download_url": f"/api/kaggle/download/{dataset_ref}"
            }
            formatted_results.append(obj)
            
        return formatted_results
    except Exception as e:
        raise Exception(f"Failed to search Data Hub datasets: {str(e)}")

def download_kaggle_dataset(dataset_ref: str, download_path: str = None):
    """
    Downloads a Kaggle dataset by its reference (username/dataset-name).
    Returns the path to the downloaded files.
    """
    if download_path is None:
        download_path = KAGGLE_DIR
    if not KAGGLE_READY:
        raise Exception("Kaggle API is not correctly authenticated.")
    
    try:
        if not os.path.exists(download_path):
            os.makedirs(download_path, exist_ok=True)
            
        api.dataset_download_files(dataset_ref, path=download_path, unzip=True)
        return download_path
    except Exception as e:
        raise Exception(f"Failed to download Kaggle dataset {dataset_ref}: {str(e)}")
