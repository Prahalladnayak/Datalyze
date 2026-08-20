from fastapi import APIRouter, HTTPException
from typing import List
from models import SearchRequest, DatasetMetadata
from services import kaggle_service

router = APIRouter()

@router.post("", response_model=List[DatasetMetadata])
@router.post("/", response_model=List[DatasetMetadata])
def search_datasets(request: SearchRequest):
    """
    Search for existing datasets by topic or query string using Kaggle API.
    """
    try:
        search_query = request.query if request.query.strip() else (request.topic or "dataset")
        
        # Limiting to 30 results for pagination
        datasets = kaggle_service.search_kaggle_datasets(query=search_query, max_results=30)
        
        if request.topic and request.topic != "All Topics":
            filtered = []
            for ds in datasets:
                # Naive topic matching, fallback to setting topic
                ds["topic"] = request.topic
                filtered.append(ds)
            datasets = filtered
        else:
            for ds in datasets: ds["topic"] = "General"

        return datasets
    except Exception as e:
        print("Kaggle search error:", e)
        raise HTTPException(status_code=500, detail=str(e))
