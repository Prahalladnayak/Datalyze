import pandas as pd
import numpy as np
import io
import csv
import os

def format_csv_to_json(csv_string: str):
    """
    Converts a raw CSV string into a structured JSON dictionary using Pandas.
    """
    try:
        lines = csv_string.strip().split('\n')
        clean_lines = [line for line in lines if line.strip() and "Here" not in line and "Sure" not in line and not line.startswith("```")]
        cleaned_csv_string = '\n'.join(clean_lines)
        
        df = pd.read_csv(io.StringIO(cleaned_csv_string), skipinitialspace=True, on_bad_lines='skip')
        df.columns = df.columns.str.strip()
        data_json = df.to_dict(orient="records")
        return data_json, df
    except Exception as e:
        raise Exception(f"Failed to parse CSV string: {str(e)}")

def get_preview(df: pd.DataFrame, num_rows: int = 10):
    """
    Returns the first `num_rows` rows of a DataFrame as JSON.
    """
    try:
        preview_df = df.head(num_rows).fillna("")
        return preview_df.to_dict(orient="records")
    except Exception as e:
        raise Exception(f"Failed to generate dataset preview: {str(e)}")

# ANOMALY INJECTION FUNCTIONS
def add_missing_values(df: pd.DataFrame, fraction: float = 0.05) -> pd.DataFrame:
    """Injects np.nan randomly into the dataset. Labeled: synthetic corruption for testing purposes."""
    df_new = df.copy()
    for col in df_new.columns:
        if col.lower() != 'id':
            mask = np.random.rand(len(df_new)) < fraction
            df_new.loc[mask, col] = np.nan
    return df_new

def add_outliers(df: pd.DataFrame, fraction: float = 0.05) -> pd.DataFrame:
    """Injects extreme values into numeric columns. Labeled: simulation / robustness testing only."""
    df_new = df.copy()
    num_cols = df_new.select_dtypes(include=[np.number]).columns
    for col in num_cols:
        mask = np.random.rand(len(df_new)) < fraction
        df_new.loc[mask, col] = df_new.loc[mask, col] * np.random.uniform(5, 20, size=mask.sum())
    return df_new

def add_noise(df: pd.DataFrame) -> pd.DataFrame:
    """Adds Gaussian noise to numeric columns. Labeled: simulation / robustness testing only."""
    df_new = df.copy()
    num_cols = df_new.select_dtypes(include=[np.number]).columns
    for col in num_cols:
        std = df_new[col].std()
        if pd.notna(std) and std > 0:
            noise = np.random.normal(0, std * 0.1, len(df_new))
            df_new[col] = df_new[col] + noise
    return df_new

# NOTE: apply_scaling() has been intentionally removed.
# Feature scaling should NEVER occur at dataset generation time. It causes data leakage
# and produces statistically incorrect evaluation when applied before train/test splits.
# Scaling belongs exclusively inside ML preprocessing pipelines (Model Builder phase).

EXPORT_FORMATS = {
    "csv":     ("text/csv",                                  "csv"),
    "excel":   ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
    "json":    ("application/json",                          "json"),
    "parquet": ("application/octet-stream",                  "parquet"),
    "feather": ("application/octet-stream",                  "feather"),
    "tsv":     ("text/tab-separated-values",                 "tsv"),
    "zip":     ("application/zip",                           "zip"),
}

def export_dataset(df: pd.DataFrame, base_path: str, dataset_id: str, fmt: str):
    """
    Exports a DataFrame to the requested format.
    Returns (output_path, media_type, filename).
    Supports: csv, excel, json, parquet, feather, tsv
    """
    if fmt not in EXPORT_FORMATS:
        fmt = "csv"  # safe fallback

    media_type, ext = EXPORT_FORMATS[fmt]
    short_id = dataset_id[:8]
    fname = f"synthetic_dataset_{short_id}.{ext}"
    out_path = f"{base_path}_export.{ext}"

    if fmt == "csv":
        df.to_csv(out_path, index=False)
    elif fmt == "excel":
        df.to_excel(out_path, index=False)
    elif fmt == "json":
        df.to_json(out_path, orient="records", indent=2)
    elif fmt == "parquet":
        df.to_parquet(out_path, index=False)
    elif fmt == "feather":
        df.reset_index(drop=True).to_feather(out_path)
    elif fmt == "tsv":
        df.to_csv(out_path, index=False, sep="\t")
    elif fmt == "zip":
        import os, zipfile
        csv_path = f"{base_path}_temp.csv"
        df.to_csv(csv_path, index=False)
        with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(csv_path, arcname=f"synthetic_dataset_{short_id}.csv")
        if os.path.exists(csv_path):
            os.remove(csv_path)

    return out_path, media_type, fname
