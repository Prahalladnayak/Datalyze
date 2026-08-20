"""
ml-service/services/model_service.py

Core ML training engine for Datalyze.
Handles supervised learning (classification/regression) and clustering.

Moved from backend/services/model_service.py to ml-service/.
The backend no longer calls sklearn directly — all training is delegated here.
"""

import pandas as pd
import numpy as np
import io
import time
import base64
import matplotlib
import matplotlib.pyplot as plt
import seaborn as sns
matplotlib.use('Agg')  # Ensure plot rendering without GUI

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.decomposition import PCA

# Classification
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

# Regression
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.svm import SVR
from sklearn.neighbors import KNeighborsRegressor
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error

# Clustering
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.metrics import silhouette_score


def generate_eda_plots(df: pd.DataFrame, target_col: str):
    plots = {}

    # Common function to convert plot to base64
    def fig_to_base64(fig):
        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', transparent=True)
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)
        return f"data:image/png;base64,{img_str}"

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()

    # Set universal strict dark theme properties to match UI
    plt.style.use('dark_background')
    import matplotlib as mpl
    mpl.rcParams['text.color'] = '#9ca3af'
    mpl.rcParams['axes.labelcolor'] = '#9ca3af'
    mpl.rcParams['xtick.color'] = '#9ca3af'
    mpl.rcParams['ytick.color'] = '#9ca3af'
    mpl.rcParams['axes.edgecolor'] = '#374151'
    mpl.rcParams['figure.facecolor'] = 'none'
    mpl.rcParams['axes.facecolor'] = 'none'

    # 1. Target Distribution (Bar for classification, Hist for regression)
    fig, ax = plt.subplots(figsize=(6, 4))
    if df[target_col].nunique() < 15:
        sns.countplot(x=df[target_col], ax=ax, palette='Purples_r')
        ax.set_title(f"Target Distribution: {target_col}", color='white', pad=15)
    else:
        sns.histplot(df[target_col], kde=True, ax=ax, color='#a855f7')
        ax.set_title(f"Target Distribution: {target_col}", color='white', pad=15)
    plots['target_distribution'] = fig_to_base64(fig)

    # 2. Correlation Heatmap (Numeric)
    if len(numeric_cols) > 1:
        fig, ax = plt.subplots(figsize=(8, 6))
        # Keep it small to avoid crowded massive heatmaps
        corr = df[numeric_cols[:15]].corr()
        sns.heatmap(corr, annot=False, cmap='magma', ax=ax, center=0)
        ax.set_title("Numeric Correlation Heatmap", color='white', pad=15)
        plots['correlation_heatmap'] = fig_to_base64(fig)

    return plots


def train_and_evaluate(df: pd.DataFrame, target_col: str, task_type: str, perform_eda: bool = False):
    """
    Trains multiple models for the given task type and evaluates their performance.
    Returns a leaderboard dictionary, plus specific stats like feature importance for RF, and confusion matrix.
    """
    start_time = time.time()

    # Drop rows where target is missing
    df = df.dropna(subset=[target_col])
    if len(df) < 20:
        raise ValueError("Dataset must have at least 20 valid rows after dropping missing targets.")

    # 1. Split Data
    X = df.drop(columns=[target_col])
    y = df[target_col]

    # Quick heuristic to decide numerical / categorical
    numeric_features = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_features = X.select_dtypes(exclude=[np.number]).columns.tolist()

    # Exclude IDs or totally unique columns from categoricals to avoid exploding memory
    categorical_features = [col for col in categorical_features if X[col].nunique() < 20]
    X = X[numeric_features + categorical_features]

    # Preprocessing
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='mean')),
        ('scaler', StandardScaler())
    ])

    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ])

    is_classification = task_type.lower() == 'classification'

    # Determine split params
    if is_classification:
        if y.nunique() < 2:
            raise ValueError("Target column must have at least 2 distinct classes for classification.")
        try:
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
        except ValueError:
            # Fallback if classes are too small
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    else:
        # Prevent regression on strings
        if not pd.api.types.is_numeric_dtype(y):
            raise ValueError("Target column for regression must be entirely numeric.")

        # Fill missing targets
        y = y.fillna(y.mean())
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Models Dictionary
    if is_classification:
        models = {
            'Logistic Regression': LogisticRegression(max_iter=1000, random_state=42),
            'Decision Tree': DecisionTreeClassifier(random_state=42),
            'Random Forest': RandomForestClassifier(n_estimators=100, random_state=42),
            'Gradient Boosting': GradientBoostingClassifier(random_state=42),
            'SVM': SVC(random_state=42),
            'KNN': KNeighborsClassifier()
        }
    else:
        models = {
            'Linear Regression': LinearRegression(),
            'Decision Tree': DecisionTreeRegressor(random_state=42),
            'Random Forest': RandomForestRegressor(n_estimators=100, random_state=42),
            'Gradient Boosting': GradientBoostingRegressor(random_state=42),
            'SVR': SVR(),
            'KNN': KNeighborsRegressor()
        }

    leaderboard = []
    feature_importance = None
    conf_matrix = None
    best_model_name = None
    best_score = -float('inf')

    # Fit transformer
    try:
        X_train_processed = preprocessor.fit_transform(X_train)
        X_test_processed = preprocessor.transform(X_test)
    except Exception as pe:
        import logging
        logging.warning(f"Data preprocessing failed: {pe}")
        raise ValueError(f"Data preprocessing failed: {str(pe)}. Please check feature columns for missing values or invalid data types.")

    feature_names = numeric_features.copy()
    if categorical_features:
        try:
            cat_encoder = preprocessor.named_transformers_['cat'].named_steps['onehot']
            cat_feature_names = cat_encoder.get_feature_names_out(categorical_features)
            feature_names.extend(cat_feature_names)
        except Exception as e:
            import logging
            logging.warning(f"Failed to extract categorical feature names: {e}")

    for name, model in models.items():
        row = {'name': name}
        try:
            model.fit(X_train_processed, y_train)
            y_pred = model.predict(X_test_processed)

            if is_classification:
                try:
                    acc = accuracy_score(y_test, y_pred)
                    acc_str = f"{acc * 100:.1f}%"
                except Exception as me:
                    import logging
                    logging.warning(f"Failed to calculate accuracy for {name}: {me}")
                    acc = None
                    acc_str = "Not Applicable"

                try:
                    prec = precision_score(y_test, y_pred, average='weighted', zero_division=0)
                    prec_str = f"{prec * 100:.1f}%"
                except Exception as me:
                    import logging
                    logging.warning(f"Failed to calculate precision for {name}: {me}")
                    prec_str = "N/A"

                try:
                    rec = recall_score(y_test, y_pred, average='weighted', zero_division=0)
                    rec_str = f"{rec * 100:.1f}%"
                except Exception as me:
                    import logging
                    logging.warning(f"Failed to calculate recall for {name}: {me}")
                    rec_str = "N/A"

                try:
                    f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
                    f1_str = f"{f1 * 100:.1f}%"
                except Exception as me:
                    import logging
                    logging.warning(f"Failed to calculate F1 score for {name}: {me}")
                    f1_str = "N/A"

                row.update({
                    'status': 'SUCCESS',
                    'acc': acc_str,
                    'prec': prec_str,
                    'rec': rec_str,
                    'f1': f1_str
                })
                score_val = acc

                # Extract Confusion Matrix if it's the best score so far
                if acc is not None and acc > best_score:
                    best_score = acc
                    best_model_name = name

                    try:
                        cm = confusion_matrix(y_test, y_pred)
                        if cm.shape == (2, 2):
                            tn, fp, fn, tp = cm.ravel()
                            conf_matrix = {
                                "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
                                "binary": True
                            }
                        else:
                            conf_matrix = {"binary": False, "size": cm.shape[0]}
                    except Exception as cme:
                        import logging
                        logging.warning(f"Failed to calculate confusion matrix for {name}: {cme}")

            else:
                try:
                    r2 = r2_score(y_test, y_pred)
                    acc_str = f"{r2 * 100:.1f}% (R²)"
                except Exception as me:
                    import logging
                    logging.warning(f"Failed to calculate R2 score for {name}: {me}")
                    r2 = None
                    acc_str = "N/A"

                try:
                    mae = mean_absolute_error(y_test, y_pred)
                    prec_str = f"{mae:.2f} (MAE)"
                except Exception as me:
                    import logging
                    logging.warning(f"Failed to calculate MAE for {name}: {me}")
                    prec_str = "N/A"

                try:
                    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
                    rec_str = f"{rmse:.2f} (RMSE)"
                except Exception as me:
                    import logging
                    logging.warning(f"Failed to calculate RMSE for {name}: {me}")
                    rec_str = "N/A"

                row.update({
                    'status': 'SUCCESS',
                    'acc': acc_str,
                    'prec': prec_str,
                    'rec': rec_str,
                    'f1': "N/A"
                })
                score_val = r2

                if r2 is not None and r2 > best_score:
                    best_score = r2
                    best_model_name = name

            # Extract RF feature importance natively
            if name == 'Random Forest':
                try:
                    importances = model.feature_importances_
                    fi_list = [{"name": fname, "val": float(imp * 100)} for fname, imp in zip(feature_names, importances)]
                    fi_list = sorted(fi_list, key=lambda x: x['val'], reverse=True)[:5]
                    feature_importance = fi_list
                except Exception as fie:
                    import logging
                    logging.warning(f"Failed to extract RF feature importances: {fie}")

            leaderboard.append(row)

        except Exception as e:
            import logging
            logging.warning(f"Model training/evaluation failed for {name}: {e}")
            row.update({
                'status': 'FAILED',
                'acc': 'N/A',
                'prec': 'N/A',
                'rec': 'N/A',
                'f1': 'N/A',
                '_error_reason': str(e)
            })
            leaderboard.append(row)

    # Flag the best model
    for item in leaderboard:
        if best_model_name and item.get('status') == 'SUCCESS' and item['name'] == best_model_name:
            item['best'] = True
        else:
            item['best'] = False

    # Sort
    def get_sort_key(item):
        if item.get('status') == 'FAILED':
            return -2
        acc_str = item.get('acc', 'N/A')
        if 'N/A' in str(acc_str) or 'Not Applicable' in str(acc_str):
            return -1
        try:
            if '%' in str(acc_str):
                return float(str(acc_str).split('%')[0])
            return float(acc_str)
        except Exception:
            return -1

    leaderboard = sorted(leaderboard, key=get_sort_key, reverse=True)

    elapsed_time = time.time() - start_time

    response_payload = {
        "leaderboard": leaderboard,
        "feature_importance": feature_importance,
        "confusion_matrix": conf_matrix,
        "execution_time_seconds": round(elapsed_time, 2)
    }

    if perform_eda:
        response_payload["eda_plots"] = generate_eda_plots(df, target_col)

    return response_payload


def train_clustering(df: pd.DataFrame, algorithm: str = "kmeans", n_clusters: int = 3, pca_components: int = None):
    """
    Trains a clustering model on the dataset and computes evaluation metrics.
    Task: Unsupervised — no target column needed.
    Algorithms: KMeans, DBSCAN, Agglomerative
    """
    start_time = time.time()

    # 1. Select only numeric columns; impute missing values
    numeric_df = df.select_dtypes(include=[np.number]).dropna(axis=1, how='all')
    imputer = SimpleImputer(strategy='mean')
    X = imputer.fit_transform(numeric_df)

    # 2. Standardize input
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 3. Optional PCA dimensionality reduction
    pca_explained_variance = None
    if pca_components and pca_components > 0 and pca_components < X_scaled.shape[1]:
        pca = PCA(n_components=pca_components, random_state=42)
        X_scaled = pca.fit_transform(X_scaled)
        pca_explained_variance = round(float(pca.explained_variance_ratio_.sum() * 100), 1)

    # 4. Fit clustering model
    algorithm = algorithm.lower()
    labels = None
    inertia = None

    if algorithm == "kmeans":
        model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        model.fit(X_scaled)
        labels = model.labels_
        inertia = round(float(model.inertia_), 4)
    elif algorithm == "dbscan":
        model = DBSCAN(eps=0.5, min_samples=5)
        model.fit(X_scaled)
        labels = model.labels_
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)  # override
    elif algorithm == "agglomerative":
        model = AgglomerativeClustering(n_clusters=n_clusters)
        labels = model.fit_predict(X_scaled)
    else:
        raise ValueError(f"Unknown clustering algorithm: {algorithm}. Use 'kmeans', 'dbscan', or 'agglomerative'.")

    # 5. Evaluation metrics
    silhouette = None
    n_unique_labels = len(set(labels))
    if n_unique_labels >= 2:
        try:
            silhouette = round(float(silhouette_score(X_scaled, labels)), 4)
        except Exception:
            silhouette = None

    # 6. Cluster distribution
    from collections import Counter
    cluster_counts = Counter(labels.tolist())
    cluster_distribution = [{"cluster": str(k), "count": int(v)} for k, v in sorted(cluster_counts.items())]

    elapsed_time = time.time() - start_time

    return {
        "algorithm": algorithm,
        "n_clusters_detected": n_unique_labels,
        "n_clusters_requested": n_clusters if algorithm != "dbscan" else None,
        "silhouette_score": silhouette,
        "inertia": inertia,
        "pca_used": pca_components is not None and pca_components > 0,
        "pca_components": pca_components,
        "pca_explained_variance_pct": pca_explained_variance,
        "cluster_distribution": cluster_distribution,
        "features_used": numeric_df.columns.tolist(),
        "execution_time_seconds": round(elapsed_time, 2)
    }
