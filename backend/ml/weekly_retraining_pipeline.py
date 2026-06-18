import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from psycopg.rows import dict_row
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from train_operational_models import (
    build_operational_frame,
    save_artifacts as save_operational_artifacts,
    train_operational_models,
)

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from app.core.config import get_database_url

MODEL_FEATURES = [
    "event_cause_grouped",
    "event_type",
    "priority",
    "requires_road_closure",
    "corridor",
    "zone",
    "latitude",
    "longitude",
    "hour",
    "day_of_week",
    "month",
]

CATEGORICAL_COLUMNS = [
    "event_cause_grouped",
    "event_type",
    "priority",
    "requires_road_closure",
    "corridor",
    "zone",
]

NUMERIC_COLUMNS = [
    "latitude",
    "longitude",
    "hour",
    "day_of_week",
    "month",
]


def load_astram_dataset(csv_path: Path) -> pd.DataFrame:
    raw_df = pd.read_csv(csv_path)
    return prepare_training_frame(raw_df)


def prepare_training_frame(raw_df: pd.DataFrame) -> pd.DataFrame:
    df = raw_df.copy()
    for column in ["start_datetime", "closed_datetime", "resolved_datetime", "end_datetime"]:
        if column in df.columns:
            df[column] = pd.to_datetime(df[column], errors="coerce")

    completion_candidates = [
        column
        for column in ["closed_datetime", "resolved_datetime", "end_datetime"]
        if column in df.columns
    ]
    if not completion_candidates:
        raise ValueError("No completion datetime column found")

    df["completion_datetime"] = df[completion_candidates].bfill(axis=1).iloc[:, 0]
    df["effective_start_time"] = df["start_datetime"]
    df["duration_minutes"] = (
        df["completion_datetime"] - df["effective_start_time"]
    ).dt.total_seconds() / 60

    if "event_cause_grouped" not in df.columns:
        df["event_cause_grouped"] = df.get("event_cause", "unknown").fillna("unknown")

    if "hour" not in df.columns:
        df["hour"] = df["effective_start_time"].dt.hour
    if "day_of_week" not in df.columns:
        df["day_of_week"] = df["effective_start_time"].dt.dayofweek
    if "month" not in df.columns:
        df["month"] = df["effective_start_time"].dt.month

    for column in MODEL_FEATURES:
        if column not in df.columns:
            df[column] = "unknown" if column in CATEGORICAL_COLUMNS else np.nan

    model_df = df[MODEL_FEATURES + ["duration_minutes"]].copy()
    model_df = model_df.dropna(subset=["duration_minutes", "latitude", "longitude"])
    model_df = model_df[model_df["duration_minutes"] >= 0].copy()

    for column in CATEGORICAL_COLUMNS:
        model_df[column] = model_df[column].fillna("unknown").astype(str)
    for column in NUMERIC_COLUMNS:
        model_df[column] = pd.to_numeric(model_df[column], errors="coerce")

    model_df = model_df.dropna(subset=NUMERIC_COLUMNS)
    model_df["log_duration"] = np.log1p(model_df["duration_minutes"])
    model_df["impact_level"] = model_df["duration_minutes"].apply(impact_level)
    return model_df


def load_retraining_dataset() -> pd.DataFrame:
    database_url = get_database_url()
    if not database_url:
        return pd.DataFrame()

    import psycopg

    try:
        with psycopg.connect(database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select
                        event_cause_grouped,
                        event_type,
                        priority,
                        requires_road_closure,
                        corridor,
                        zone,
                        latitude,
                        longitude,
                        hour,
                        day_of_week,
                        month,
                        coalesce(actual_duration_minutes, predicted_duration_minutes) as duration_minutes,
                        coalesce(actual_impact_level, predicted_impact_level) as impact_level
                    from retraining_prediction_dataset
                    """
                )
                rows = cursor.fetchall()
    except Exception:
        return pd.DataFrame()

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df["duration_minutes"] = pd.to_numeric(df["duration_minutes"], errors="coerce")
    df = df.dropna(subset=["duration_minutes"])
    df["log_duration"] = np.log1p(df["duration_minutes"])
    return df[MODEL_FEATURES + ["duration_minutes", "log_duration", "impact_level"]]


def impact_level(duration_minutes: float) -> str:
    if duration_minutes <= 72:
        return "Low"
    if duration_minutes <= 793:
        return "Medium"
    if duration_minutes <= 17146:
        return "High"
    return "Critical"


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_COLUMNS),
            ("num", "passthrough", NUMERIC_COLUMNS),
        ]
    )


def train_models(model_df: pd.DataFrame) -> dict[str, Any]:
    X_duration = model_df[MODEL_FEATURES]
    y_duration = model_df["log_duration"]

    X_train, X_test, y_train, y_test = train_test_split(
        X_duration,
        y_duration,
        test_size=0.2,
        random_state=42,
    )

    duration_model = Pipeline(
        [
            ("preprocessor", build_preprocessor()),
            (
                "rf",
                RandomForestRegressor(
                    n_estimators=300,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )
    duration_model.fit(X_train, y_train)
    duration_preds = duration_model.predict(X_test)

    X_impact = model_df[MODEL_FEATURES]
    y_impact = model_df["impact_level"]
    stratify = y_impact if y_impact.value_counts().min() >= 2 else None
    Xc_train, Xc_test, yc_train, yc_test = train_test_split(
        X_impact,
        y_impact,
        test_size=0.2,
        random_state=42,
        stratify=stratify,
    )

    impact_model = Pipeline(
        [
            ("preprocessor", build_preprocessor()),
            (
                "rf",
                RandomForestClassifier(
                    n_estimators=300,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )
    impact_model.fit(Xc_train, yc_train)
    impact_preds = impact_model.predict(Xc_test)

    return {
        "duration_model": duration_model,
        "impact_model": impact_model,
        "metrics": {
            "source_rows": int(len(model_df)),
            "duration_mae_log": float(mean_absolute_error(y_test, duration_preds)),
            "duration_r2_log": float(r2_score(y_test, duration_preds)),
            "impact_accuracy": float(accuracy_score(yc_test, impact_preds)),
        },
    }


def save_artifacts(result: dict[str, Any], output_dir: Path) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    model_version = datetime.now(timezone.utc).strftime("weekly-%Y%m%d%H%M%S")

    duration_path = output_dir / f"duration_model_{model_version}.pkl"
    impact_path = output_dir / f"impact_model_{model_version}.pkl"
    metrics_path = output_dir / f"metrics_{model_version}.json"
    duration_columns_path = output_dir / f"duration_feature_columns_{model_version}.json"
    impact_columns_path = output_dir / f"impact_feature_columns_{model_version}.json"

    joblib.dump(result["duration_model"], duration_path)
    joblib.dump(result["impact_model"], impact_path)
    metrics_path.write_text(json.dumps(result["metrics"], indent=2), encoding="utf-8")
    duration_columns_path.write_text(json.dumps(MODEL_FEATURES), encoding="utf-8")
    impact_columns_path.write_text(json.dumps(MODEL_FEATURES), encoding="utf-8")

    return {
        "model_version": model_version,
        "duration_path": str(duration_path),
        "impact_path": str(impact_path),
        "metrics_path": str(metrics_path),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, type=Path)
    parser.add_argument("--output-dir", default=Path("app/models/candidates"), type=Path)
    args = parser.parse_args()

    historical_df = load_astram_dataset(args.csv)
    retraining_df = load_retraining_dataset()
    model_df = pd.concat([historical_df, retraining_df], ignore_index=True)
    result = train_models(model_df)
    artifacts = save_artifacts(result, args.output_dir)

    operational_df = build_operational_frame(args.csv)
    operational_result = train_operational_models(operational_df)
    save_operational_artifacts(operational_result, args.output_dir)

    print(
        json.dumps(
            {
                "artifacts": artifacts,
                "metrics": result["metrics"],
                "operational_metrics": operational_result["metrics"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
