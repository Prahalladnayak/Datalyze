import pandas as pd
import numpy as np
import io
import re
import string
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, PowerTransformer

# --- NLP text cleaning helpers ---
_STOPWORDS = {
    "i","me","my","myself","we","our","ours","ourselves","you","your","yours","yourself",
    "he","him","his","himself","she","her","hers","herself","it","its","itself","they",
    "them","their","theirs","themselves","what","which","who","whom","this","that","these",
    "those","am","is","are","was","were","be","been","being","have","has","had","having",
    "do","does","did","doing","a","an","the","and","but","if","or","because","as","until",
    "while","of","at","by","for","with","about","against","between","into","through",
    "during","before","after","above","below","to","from","up","down","in","out","on",
    "off","over","under","again","further","then","once","here","there","when","where",
    "why","how","all","both","each","few","more","most","other","some","such","no","nor",
    "not","only","own","same","so","than","too","very","s","t","can","will","just","don",
    "should","now","d","ll","m","o","re","ve","y","ain","aren","couldn","didn","doesn",
    "hadn","hasn","haven","isn","ma","mightn","mustn","needn","shan","shouldn","wasn",
    "weren","won","wouldn"
}

def analyze_dataset(df: pd.DataFrame):
    """
    Returns summary statistics for the dataset: rows, columns, missing, duplicates, outliers.
    """
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    
    # Calculate outliers using simple IQR
    outliers_count = 0
    for col in numeric_cols:
        Q1 = df[col].quantile(0.25)
        Q3 = df[col].quantile(0.75)
        IQR = Q3 - Q1
        outliers_count += ((df[col] < (Q1 - 1.5 * IQR)) | (df[col] > (Q3 + 1.5 * IQR))).sum()

    return {
        "rows": len(df),
        "columns": len(df.columns),
        "missing_values": int(df.isnull().sum().sum()),
        "duplicates": int(df.duplicated().sum()),
        "outliers": int(outliers_count)
    }

def detect_column_types(df: pd.DataFrame) -> list:
    """
    Auto-detects column types and recommends the best null-handling strategy per column.
    Returns a list of column analysis objects.
    """
    results = []
    for col in df.columns:
        dtype = df[col].dtype
        missing_count = int(df[col].isnull().sum())
        missing_pct = round((missing_count / len(df)) * 100, 1) if len(df) > 0 else 0.0
        unique_count = int(df[col].nunique())

        if pd.api.types.is_numeric_dtype(dtype):
            col_type = "numeric"
            recommended_strategy = "mean"  # Safe default for numeric
        elif pd.api.types.is_datetime64_any_dtype(dtype):
            col_type = "datetime"
            recommended_strategy = "drop"
        elif unique_count / max(len(df), 1) > 0.8:
            col_type = "identifier"
            recommended_strategy = "ignore"  # IDs and high-cardinality text are best left alone
        else:
            col_type = "categorical"
            recommended_strategy = "mode"  # Mode is appropriate for categoricals

        results.append({
            "name": col,
            "detected_type": col_type,
            "dtype": str(dtype),
            "missing_count": missing_count,
            "missing_pct": missing_pct,
            "unique_count": unique_count,
            "recommended_null_strategy": recommended_strategy
        })
    return results


def apply_cleaning(df: pd.DataFrame, config: dict):
    """
    Applies the requested operations to the dataframe and returns the cleaned dataframe.
    Null strategies are applied per data type automatically unless overridden by column config.
    """
    df_clean = df.copy()

    # 1. Null Handling (smart: respects type constraints)
    handle_nulls = config.get("handle_nulls", "ignore")
    column_overrides = config.get("column_overrides", {})  # optional per-column override dict

    for col in df_clean.columns:
        strategy = column_overrides.get(col, handle_nulls)
        is_numeric = pd.api.types.is_numeric_dtype(df_clean[col])

        if strategy == "drop":
            continue  # handled globally after loop
        elif strategy == "mean":
            if is_numeric:
                df_clean[col] = df_clean[col].fillna(df_clean[col].mean())
        elif strategy == "median":
            if is_numeric:
                df_clean[col] = df_clean[col].fillna(df_clean[col].median())
        elif strategy == "mode":
            if not df_clean[col].mode().empty:
                df_clean[col] = df_clean[col].fillna(df_clean[col].mode()[0])
        elif strategy == "constant":
            const_val = config.get("null_constant", "Unknown")
            df_clean[col] = df_clean[col].fillna(const_val)

    # drop empty rows if strategy is global drop
    if handle_nulls == "drop":
        df_clean = df_clean.dropna()

    # 2. Duplicate Handling
    if config.get("drop_duplicates", True):
        df_clean = df_clean.drop_duplicates()

    # 3. Data Type Correction (Inference)
    if config.get("correct_types", True):
        df_clean = df_clean.convert_dtypes()

    # 4. Outlier Handling
    handling_outliers = config.get("handling_outliers", "ignore")
    num_cols = df_clean.select_dtypes(include=[np.number]).columns
    if handling_outliers != "ignore" and len(num_cols) > 0:
        for col in num_cols:
            if handling_outliers in ["iqr_drop", "iqr_cap"]:
                Q1 = df_clean[col].quantile(0.25)
                Q3 = df_clean[col].quantile(0.75)
                IQR = Q3 - Q1
                lower = Q1 - 1.5 * IQR
                upper = Q3 + 1.5 * IQR
                if handling_outliers == "iqr_drop":
                    df_clean = df_clean[(df_clean[col] >= lower) & (df_clean[col] <= upper)]
                elif handling_outliers == "iqr_cap":
                    df_clean[col] = np.clip(df_clean[col], lower, upper)
            elif handling_outliers in ["zscore_drop", "zscore_cap"]:
                mean = df_clean[col].mean()
                std = df_clean[col].std()
                lower = mean - 3 * std
                upper = mean + 3 * std
                if handling_outliers == "zscore_drop":
                    df_clean = df_clean[(df_clean[col] >= lower) & (df_clean[col] <= upper)]
                elif handling_outliers == "zscore_cap":
                    df_clean[col] = np.clip(df_clean[col], lower, upper)
            elif handling_outliers in ["mad_drop", "mad_cap"]:
                # Modified Z-Score using Median Absolute Deviation (MAD)
                median = df_clean[col].median()
                mad = np.median(np.abs(df_clean[col] - median))
                modified_z = 0.6745 * (df_clean[col] - median) / (mad + 1e-10)
                lower_mask = modified_z >= -3.5
                upper_mask = modified_z <= 3.5
                if handling_outliers == "mad_drop":
                    df_clean = df_clean[lower_mask & upper_mask]
                elif handling_outliers == "mad_cap":
                    lower_bound = median - 3.5 * mad / 0.6745
                    upper_bound = median + 3.5 * mad / 0.6745
                    df_clean[col] = np.clip(df_clean[col], lower_bound, upper_bound)

    # Re-calculate numeric columns after potential dropping
    num_cols = df_clean.select_dtypes(include=[np.number]).columns

    # 5. Feature Scaling (belongs here in preprocessing, NOT in generation)
    scaling = config.get("scaling", "ignore")
    if scaling != "ignore" and len(num_cols) > 0 and len(df_clean) > 0:
        if scaling == "standard":
            scaler = StandardScaler()
            df_clean[num_cols] = scaler.fit_transform(df_clean[num_cols])
        elif scaling == "minmax":
            scaler = MinMaxScaler()
            df_clean[num_cols] = scaler.fit_transform(df_clean[num_cols])
        elif scaling == "robust":
            scaler = RobustScaler()
            df_clean[num_cols] = scaler.fit_transform(df_clean[num_cols])
        elif scaling == "power":
            # PowerTransformer (Yeo-Johnson) handles both positive and negative values
            scaler = PowerTransformer(method='yeo-johnson')
            df_clean[num_cols] = scaler.fit_transform(df_clean[num_cols])

    # 6. Encoding
    if config.get("encoding", False) and len(df_clean) > 0:
        cat_cols = df_clean.select_dtypes(include=["object", "string", "category"]).columns
        cols_to_encode = [c for c in cat_cols if df_clean[c].nunique() < 50]
        if cols_to_encode:
            df_clean = pd.get_dummies(df_clean, columns=cols_to_encode, drop_first=True)
            # Cast bool dummy columns to int (Pandas 1.5+ returns bool by default)
            bool_cols = df_clean.select_dtypes(include=["bool"]).columns
            if len(bool_cols):
                df_clean[bool_cols] = df_clean[bool_cols].astype(int)

    # 7. Rare Category Grouping
    rare_threshold = config.get("rare_category_threshold", 0)
    if rare_threshold > 0:
        cat_cols = df_clean.select_dtypes(include=["object", "category"]).columns
        for col in cat_cols:
            freq = df_clean[col].value_counts(normalize=True)
            rare_cats = freq[freq < (rare_threshold / 100.0)].index
            if len(rare_cats) > 0:
                df_clean[col] = df_clean[col].apply(
                    lambda x: "__Other__" if x in rare_cats else x
                )

    # 8. NLP Text Cleaning (applied to text/identifier columns)
    text_config = config.get("text_cleaning", {})
    nlp_report = {"text_cols_cleaned": [], "status": "skipped", "reason": "No NLP options selected"}
    if isinstance(text_config, dict):
        # Normalize values: coerce string "true"/"false" to bool so any() works correctly
        normalized = {
            k: (v if isinstance(v, bool) else str(v).lower() == 'true')
            for k, v in text_config.items()
        }
        if any(normalized.values()):
            df_clean, nlp_report = apply_text_cleaning(df_clean, normalized)

    return df_clean, nlp_report


def detect_text_columns(df: pd.DataFrame) -> list:
    """
    Auto-detects text-heavy columns: object/string dtype where average word count > 2.
    Returns list of column names.
    """
    text_cols = []
    for col in df.select_dtypes(include=["object", "string"]).columns:
        sample = df[col].dropna().astype(str)
        if len(sample) > 0:
            avg_words = sample.apply(lambda x: len(x.split())).mean()
            if avg_words > 2:
                text_cols.append(col)
    return text_cols


def apply_text_cleaning(df: pd.DataFrame, config: dict) -> tuple:
    """
    Applies a production-correct 11-step NLP text cleaning pipeline to auto-detected
    text-heavy string columns. Returns (cleaned_df, nlp_report_dict).

    Pipeline order (exact):
    1. HTML entity decoding
    2. Lowercase
    3. Remove URLs
    4. Remove Twitter artifacts (RT, @mentions)
    5. Remove emojis (if selected)
    6. Remove punctuation
    7. Remove special characters
    8. Normalize repeated characters (e.g. !!! → !)
    9. Remove stopwords
    10. Lemmatization (lightweight suffix stripping)
    11. Tokenize → clean whitespace-joined output
    """
    import html

    text_cols = detect_text_columns(df)

    if not text_cols:
        return df, {"text_cols_cleaned": [], "status": "skipped", "reason": "No text-heavy columns detected"}

    _EMOJI_PATTERN = re.compile(
        "["
        u"\U0001F600-\U0001F64F"
        u"\U0001F300-\U0001F5FF"
        u"\U0001F680-\U0001F6FF"
        u"\U0001F1E0-\U0001F1FF"
        u"\U00002500-\U00002BFF"
        u"\U0001f926-\U0001f937"
        u"\U00010000-\U0010ffff"
        u"\u2640-\u2642"
        u"\u2600-\u2B55"
        u"\u200d"
        u"\u23cf"
        u"\u23e9"
        u"\u231a"
        u"\ufe0f"
        u"\u3030"
        "]+", flags=re.UNICODE
    )

    df_out = df.copy()
    col_reports = []

    for col in text_cols:
        original_sample = df_out[col].dropna().astype(str).head(3).tolist()
        series = df_out[col].astype(str)

        # Step 1: HTML entity decode (always - critical preprocessing)
        series = series.apply(lambda x: html.unescape(x))

        # 1. Lowercasing
        if config.get("lowercase", False):
            series = series.str.lower()

        # 2. Remove URLs & Mentions (Always applied to text processing if NLP is run)
        series = series.apply(lambda x: re.sub(r'https?://\S+|www\.\S+', '', x))
        series = series.apply(lambda x: re.sub(r'@\w+', '', x))
        series = series.apply(lambda x: re.sub(r'\bRT\b', '', x))

        # 3. Remove Emojis
        if config.get("remove_emoji", False):
            series = series.apply(lambda x: _EMOJI_PATTERN.sub('', x))

        # 4. Remove Punctuation
        if config.get("remove_punctuation", False):
            series = series.apply(lambda x: x.translate(str.maketrans('', '', string.punctuation)))

        # 5. Remove Special Characters AND Slang symbols (!!!)
        if config.get("remove_special_chars", False):
            series = series.apply(lambda x: re.sub(r'[^a-zA-Z0-9\s]', '', x))
            series = series.apply(lambda x: re.sub(r'(.)\1{2,}', r'\1\1', x)) # Removes !!! -> !

        # 6. Stopword Removal
        if config.get("remove_stopwords", False):
            series = series.apply(
                lambda x: ' '.join([w for w in x.split() if w.lower() not in _STOPWORDS])
            )

        # 7. Lemmatization
        if config.get("lemmatize", False):
            def _lemmatize(text):
                words = text.split()
                result = []
                for w in words:
                    if len(w) > 5 and w.endswith('ing'):
                        w = w[:-3]
                    elif len(w) > 6 and w.endswith('tion'):
                        w = w[:-4] + 'te'
                    elif len(w) > 4 and w.endswith('ly'):
                        w = w[:-2]
                    elif len(w) > 5 and w.endswith('ness'):
                        w = w[:-4]
                    elif len(w) > 4 and w.endswith('ed'):
                        w = w[:-2]
                    result.append(w)
                return ' '.join(result)
            series = series.apply(_lemmatize)

        # 8. Token cleanup
        if config.get("tokenize", False):
            series = series.apply(lambda x: ' '.join(x.split()))

        # Strip remaining whitespace
        series = series.str.strip()

        df_out[col] = series

        # ── Trust guard: audit the transformation ──
        cleaned_sample = df_out[col].dropna().astype(str).head(3).tolist()
        col_status, col_reason = _audit_nlp_column(original_sample, cleaned_sample)
        col_reports.append({
            "column": col,
            "status": col_status,
            "reason": col_reason,
            "before_sample": original_sample[:2],
            "after_sample": cleaned_sample[:2],
        })

    overall_ok = all(r["status"] == "success" for r in col_reports)
    nlp_report = {
        "text_cols_cleaned": text_cols,
        "status": "success" if overall_ok else "partial_failure",
        "columns": col_reports,
    }
    return df_out, nlp_report


def _audit_nlp_column(before: list, after: list) -> tuple:
    """
    Returns ('success'|'failure', reason_str).
    Marks failure if cleaned text still contains Twitter artifacts, HTML entities,
    or if ALL samples are visually identical to raw input.
    """
    failure_patterns = [
        (r'&[a-z]+;', "HTML entities still present"),
        (r'&#\d+;', "HTML numeric entities still present"),
        (r'@\w+', "@mentions still present"),
        (r'\bRT\b', "RT Twitter artifact still present"),
        (r'https?://', "URLs still present"),
        (r'!!!+', "Repeated exclamation marks still present"),
        (r'[\U0001F600-\U0001F64F]', "Emojis still present"),
    ]
    
    # Check if text was transformed at all
    all_unchanged = True
    for raw, cleaned in zip(before, after):
        if raw.strip() != cleaned.strip():
            all_unchanged = False
            break
            
    if all_unchanged and any(len(raw.strip()) > 5 for raw in before):
        return "failure", "Text cleaning did not transform the data."
        
    for raw, cleaned in zip(before, after):
        # Check for remaining artifacts
        for pattern, msg in failure_patterns:
            if re.search(pattern, cleaned):
                return "failure", msg
                
    return "success", "Text cleaned successfully"
