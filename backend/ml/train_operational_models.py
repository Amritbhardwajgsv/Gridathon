import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

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

OPERATIONAL_FEATURES = MODEL_FEATURES + [
    "predicted_duration_minutes",
    "impact_level",
    "urgency_score",
    "risk_count",
    "estimated_crowd_size",
]

OPERATIONAL_CATEGORICAL_COLUMNS = [
    "event_cause_grouped",
    "event_type",
    "priority",
    "requires_road_closure",
    "corridor",
    "zone",
    "impact_level",
]

OPERATIONAL_NUMERIC_COLUMNS = [
    "latitude",
    "longitude",
    "hour",
    "day_of_week",
    "month",
    "predicted_duration_minutes",
    "urgency_score",
    "risk_count",
    "estimated_crowd_size",
]

RESOURCE_TARGETS = [
    "personnel_total",
    "constables",
    "asi",
    "si",
    "inspectors",
    "barricades",
    "tow_units",
    "medical_units",
    "diversion_confidence",
]

RISK_TERMS = {
    "crowd": ["crowd", "gathering", "rally", "procession", "festival", "match"],
    "blockage": ["blocked", "block", "stuck", "jam", "closure", "barricade"],
    "safety": ["ambulance", "emergency", "stampede", "injury", "accident", "fire"],
    "public_transport": ["bus", "metro", "school", "hospital", "airport"],
    "vip": ["vip", "vvip", "minister", "convoy"],
}

IMPACT_MULTIPLIER = {
    "Low": 1.0,
    "Medium": 1.45,
    "High": 2.2,
    "Critical": 3.1,
}


def build_operational_frame(csv_path: Path) -> pd.DataFrame:
    raw_df = pd.read_csv(csv_path)
    base_df = prepare_training_frame(raw_df)

    text_series = raw_df.get("description", pd.Series([""] * len(raw_df))).fillna("")
    text_series = text_series.astype(str).reset_index(drop=True)
    base_df = base_df.reset_index(drop=True)
    if len(text_series) < len(base_df):
        text_series = text_series.reindex(range(len(base_df)), fill_value="")
    base_df["description_text"] = text_series.iloc[: len(base_df)]

    base_df["predicted_duration_minutes"] = base_df["duration_minutes"]
    base_df["impact_level"] = base_df["duration_minutes"].apply(impact_level)
    base_df["estimated_crowd_size"] = base_df.apply(estimate_crowd_size, axis=1)
    base_df["urgency_score"] = base_df.apply(derive_urgency_score, axis=1)
    base_df["risk_count"] = base_df["description_text"].apply(count_risks)

    resource_targets = base_df.apply(derive_resource_targets, axis=1, result_type="expand")
    for column in RESOURCE_TARGETS:
        base_df[column] = resource_targets[column]
    base_df["learning_priority"] = base_df.apply(derive_learning_priority, axis=1)

    for column in OPERATIONAL_CATEGORICAL_COLUMNS:
        base_df[column] = base_df[column].fillna("unknown").astype(str)
    for column in OPERATIONAL_NUMERIC_COLUMNS + RESOURCE_TARGETS:
        base_df[column] = pd.to_numeric(base_df[column], errors="coerce")

    return base_df.dropna(subset=OPERATIONAL_NUMERIC_COLUMNS + RESOURCE_TARGETS)


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
    return model_df


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore"),
                OPERATIONAL_CATEGORICAL_COLUMNS,
            ),
            ("num", "passthrough", OPERATIONAL_NUMERIC_COLUMNS),
        ]
    )


def impact_level(duration_minutes: float) -> str:
    if duration_minutes <= 72:
        return "Low"
    if duration_minutes <= 793:
        return "Medium"
    if duration_minutes <= 17146:
        return "High"
    return "Critical"


def train_operational_models(df: pd.DataFrame) -> dict[str, Any]:
    X = df[OPERATIONAL_FEATURES]
    y_resource = df[RESOURCE_TARGETS]
    y_learning = df["learning_priority"]

    X_train, X_test, yr_train, yr_test = train_test_split(
        X, y_resource, test_size=0.2, random_state=42
    )
    resource_model = Pipeline(
        [
            ("preprocessor", build_preprocessor()),
            (
                "rf",
                MultiOutputRegressor(
                    RandomForestRegressor(
                        n_estimators=240,
                        min_samples_leaf=2,
                        random_state=42,
                        n_jobs=-1,
                    )
                ),
            ),
        ]
    )
    resource_model.fit(X_train, yr_train)
    resource_preds = resource_model.predict(X_test)

    stratify = y_learning if y_learning.value_counts().min() >= 2 else None
    Xc_train, Xc_test, yl_train, yl_test = train_test_split(
        X,
        y_learning,
        test_size=0.2,
        random_state=42,
        stratify=stratify,
    )
    learning_model = Pipeline(
        [
            ("preprocessor", build_preprocessor()),
            (
                "rf",
                RandomForestClassifier(
                    n_estimators=240,
                    min_samples_leaf=2,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )
    learning_model.fit(Xc_train, yl_train)
    learning_preds = learning_model.predict(Xc_test)

    return {
        "resource_model": resource_model,
        "learning_model": learning_model,
        "metrics": {
            "source_rows": int(len(df)),
            "resource_mae": float(mean_absolute_error(yr_test, resource_preds)),
            "learning_priority_accuracy": float(
                accuracy_score(yl_test, learning_preds)
            ),
            "target_columns": RESOURCE_TARGETS,
        },
    }


def save_artifacts(result: dict[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(result["resource_model"], output_dir / "resource_deployment_model.pkl")
    joblib.dump(result["learning_model"], output_dir / "learning_priority_model.pkl")
    (output_dir / "resource_deployment_feature_columns.json").write_text(
        json.dumps(OPERATIONAL_FEATURES), encoding="utf-8"
    )
    (output_dir / "learning_priority_feature_columns.json").write_text(
        json.dumps(OPERATIONAL_FEATURES), encoding="utf-8"
    )
    (output_dir / "resource_deployment_target_columns.json").write_text(
        json.dumps(RESOURCE_TARGETS), encoding="utf-8"
    )
    (output_dir / "operational_model_metrics.json").write_text(
        json.dumps(result["metrics"], indent=2), encoding="utf-8"
    )


def estimate_crowd_size(row: pd.Series) -> int:
    cause = str(row.get("event_cause_grouped", "")).lower()
    event_type = str(row.get("event_type", "")).lower()
    priority = str(row.get("priority", "")).lower()
    base = 1200
    if "rally" in cause or "gathering" in cause:
        base = 25000
    elif "festival" in cause:
        base = 18000
    elif "sports" in cause or "match" in cause:
        base = 30000
    elif "construction" in cause:
        base = 5000
    elif "breakdown" in cause:
        base = 800
    if event_type == "planned":
        base = int(base * 1.15)
    if priority == "critical":
        base = int(base * 1.8)
    elif priority == "high":
        base = int(base * 1.35)
    return base


def count_risks(text: str) -> int:
    normalized = str(text).lower()
    return sum(
        1
        for terms in RISK_TERMS.values()
        if any(term in normalized for term in terms)
    )


def derive_urgency_score(row: pd.Series) -> int:
    priority_score = {
        "low": 20,
        "medium": 40,
        "high": 65,
        "critical": 85,
    }.get(str(row.get("priority", "")).lower(), 45)
    closure_score = 10 if bool(row.get("requires_road_closure", False)) else 0
    risk_score = min(20, count_risks(row.get("description_text", "")) * 5)
    crowd_score = min(20, int(row.get("estimated_crowd_size", 0)) // 5000)
    return min(100, priority_score + closure_score + risk_score + crowd_score)


def derive_resource_targets(row: pd.Series) -> dict[str, float]:
    duration_hours = max(1.0, float(row["duration_minutes"]) / 60)
    impact = row["impact_level"]
    crowd_size = int(row.get("estimated_crowd_size", 0))
    crowd_factor = 1.0
    if crowd_size >= 100000:
        crowd_factor = 2.0
    elif crowd_size >= 50000:
        crowd_factor = 1.6
    elif crowd_size >= 15000:
        crowd_factor = 1.25
    elif crowd_size > 0:
        crowd_factor = 1.05

    closure = bool(row.get("requires_road_closure", False))
    closure_factor = 1.35 if closure else 1.0
    urgency = float(row.get("urgency_score", 45))
    urgency_factor = 1 + urgency / 250

    total = round(
        8
        * duration_hours
        * IMPACT_MULTIPLIER.get(impact, 1.4)
        * crowd_factor
        * closure_factor
        * urgency_factor
    )
    total = max(10, min(total, 220))
    inspectors = max(1, round(total / 80))
    si = max(1, round(total / 35))
    asi = max(2, round(total / 12))
    constables = max(6, total - inspectors - si - asi)
    barricades = max(6, round(total * (0.45 if closure else 0.25)))
    risk_count = int(row.get("risk_count", 0))
    tow_units = 1 if risk_count >= 2 or "breakdown" in str(row.get("event_cause_grouped", "")).lower() else 0
    medical_units = 1 if impact == "Critical" or urgency >= 90 else 0
    diversion_confidence = max(
        0.35,
        min(0.86, 0.82 - (0.12 if closure else 0) - urgency / 500),
    )
    return {
        "personnel_total": float(total),
        "constables": float(constables),
        "asi": float(asi),
        "si": float(si),
        "inspectors": float(inspectors),
        "barricades": float(barricades),
        "tow_units": float(tow_units),
        "medical_units": float(medical_units),
        "diversion_confidence": float(diversion_confidence),
    }


def derive_learning_priority(row: pd.Series) -> str:
    impact = row.get("impact_level")
    urgency = int(row.get("urgency_score", 0))
    duration = float(row.get("duration_minutes", 0))
    if impact == "Critical" or urgency >= 90 or duration >= 900:
        return "high"
    if impact == "High" or urgency >= 70 or duration >= 180:
        return "medium"
    return "standard"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, type=Path)
    parser.add_argument("--output-dir", default=Path("app/models"), type=Path)
    args = parser.parse_args()

    frame = build_operational_frame(args.csv)
    result = train_operational_models(frame)
    save_artifacts(result, args.output_dir)
    print(json.dumps(result["metrics"], indent=2))


if __name__ == "__main__":
    main()
