from pydantic import BaseModel
from typing import List, Optional

class SearchRequest(BaseModel):
    query: str
    topic: Optional[str] = None

class GenerateRequest(BaseModel):
    mode: str = "manual" # "manual", "nl", "intent"
    prompt: Optional[str] = None
    intent: Optional[str] = None
    domain: str = "General"
    size: int = 1000
    features: List[str] = []
    complexity: str
    format: str  # export format: csv, excel, json, parquet, feather, tsv, zip
    target_type: Optional[str] = "Classification" # "Classification", "Regression"
    class_imbalance: Optional[str] = "Low" # "Low", "Medium", "High"
    correlation_strength: Optional[str] = "Medium" # "Low", "Medium", "High"
    add_missing_values: Optional[bool] = False
    add_outliers: Optional[bool] = False
    add_noise: Optional[bool] = False

class DatasetMetadata(BaseModel):
    id: str
    name: str
    description: str
    topic: str
    size_mb: str
    rows: str
    columns: str
    download_url: str

class LiveDataRequest(BaseModel):
    source: str # e.g. "kaggle", "public_api"
    topic: str
    api_key: Optional[str] = None # Placeholder for Kaggle API key or others

class CleanRequest(BaseModel):
    dataset_id: str
    handle_nulls: str = "ignore" # "drop", "mean", "median", "mode", "ignore", "constant"
    null_constant: Optional[str] = "Unknown"
    handling_outliers: str = "ignore" # "ignore", "iqr_drop", "iqr_cap", "zscore_drop", "zscore_cap"
    scaling: str = "ignore" # "ignore", "standard", "minmax", "robust"
    encoding: bool = False # True to one-hot encode categorical
    drop_duplicates: bool = True
    correct_types: bool = True
    # Categorical
    rare_category_threshold: Optional[float] = 0  # % threshold below which a category is grouped as '__Other__'
    # Text / NLP
    text_cleaning: Optional[dict] = {} # keys: lowercase, remove_punctuation, remove_special_chars, remove_stopwords, lemmatize, tokenize, remove_emoji
