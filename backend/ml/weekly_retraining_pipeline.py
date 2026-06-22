import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import joblib
import numpy as np
import pandas as pd
from psycopg.rows import dict_row
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    mean_absolute_error,
    r2_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

try:
    from .train_operational_models import (
        build_operational_frame,
        save_artifacts as save_operational_artifacts,
        train_operational_models,
    )
except ImportError:
    from train_operational_models import (
        build_operational_frame,
        save_artifacts as save_operational_artifacts,
        train_operational_models,
    )

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from app.core.config import get_database_url

logger = logging.getLogger(__name__)

# ── Feature lists ─────────────────────────────────────────────────────────────

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
    "is_weekend",   # derived: day_of_week >= 5
    "rush_hour",    # derived: hour in morning/evening peak
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
    "is_weekend",
    "rush_hour",
]

# Traffic incidents genuinely resolved in >24 hours are data-quality issues
# (unclosed tickets, wrong closure timestamps). Cap removes outliers that
# inflate log-space MAE and bias impact quantile thresholds.
MAX_DURATION_MINUTES = 1440

# Causes grouped by real-world disruption severity for composite label
_HIGH_CAUSE = frozenset({"accident", "road_conditions", "vip_movement"})
_MED_CAUSE  = frozenset({
    "tree_fall", "water_logging", "construction",
    "public_event", "procession", "protest",
})


# ── Label function ────────────────────────────────────────────────────────────

def impact_level(
    duration_minutes: float,
    event_cause: str = "",
    requires_road_closure: bool = False,
) -> str:
    """Composite severity label: duration + cause type + road closure.

    Score breakdown (max 9):
      Duration  0-4 pts  (>30 / >90 / >240 / >480 min)
      Cause     0-3 pts  (accident/road/VIP=3, tree/flood/construction/event=2)
      Closure   0-2 pts  (road closure active)

    Thresholds are calibrated so that on the Astram dataset (capped at 1440 min)
    roughly 50% Low, 30% Medium, 15% High, 5% Critical — enough samples
    in each class for class_weight='balanced' to be effective.
    """
    score = 0
    if duration_minutes > 30:  score += 1
    if duration_minutes > 90:  score += 1
    if duration_minutes > 240: score += 1
    if duration_minutes > 480: score += 1
    cause = str(event_cause).lower()
    if cause in _HIGH_CAUSE:
        score += 3
    elif cause in _MED_CAUSE:
        score += 2
    if requires_road_closure:
        score += 2
    if score >= 6: return "Critical"
    if score >= 4: return "High"
    if score >= 2: return "Medium"
    return "Low"


# ── Data loading ──────────────────────────────────────────────────────────────

def load_astram_dataset(csv_path: Path) -> pd.DataFrame:
    raw_df = pd.read_csv(csv_path)
    return prepare_training_frame(raw_df)


def prepare_training_frame(raw_df: pd.DataFrame) -> pd.DataFrame:
    df = raw_df.copy()
    for col in ["start_datetime", "closed_datetime", "resolved_datetime", "end_datetime"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    completion_candidates = [
        col for col in ["closed_datetime", "resolved_datetime", "end_datetime"]
        if col in df.columns
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

    # Time features — compute on df before slicing so derived cols are available
    if "hour" not in df.columns:
        df["hour"] = df["effective_start_time"].dt.hour
    if "day_of_week" not in df.columns:
        df["day_of_week"] = df["effective_start_time"].dt.dayofweek
    if "month" not in df.columns:
        df["month"] = df["effective_start_time"].dt.month

    # Derived features
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["rush_hour"]  = df["hour"].isin([7, 8, 9, 17, 18, 19, 20]).astype(int)

    for col in MODEL_FEATURES:
        if col not in df.columns:
            df[col] = "unknown" if col in CATEGORICAL_COLUMNS else np.nan

    model_df = df[MODEL_FEATURES + ["duration_minutes"]].copy()
    model_df = model_df.dropna(subset=["duration_minutes", "latitude", "longitude"])
    # Remove negatives (bad timestamps) and cap at 24 hours (data-quality outliers)
    model_df = model_df[
        model_df["duration_minutes"].between(0, MAX_DURATION_MINUTES)
    ].copy()

    for col in CATEGORICAL_COLUMNS:
        model_df[col] = model_df[col].fillna("unknown").astype(str)
    for col in NUMERIC_COLUMNS:
        model_df[col] = pd.to_numeric(model_df[col], errors="coerce")

    model_df = model_df.dropna(subset=NUMERIC_COLUMNS)
    model_df["log_duration"] = np.log1p(model_df["duration_minutes"])
    model_df["impact_level"] = model_df.apply(
        lambda r: impact_level(
            r["duration_minutes"],
            r["event_cause_grouped"],
            str(r["requires_road_closure"]).lower() == "true",
        ),
        axis=1,
    )

    label_counts = model_df["impact_level"].value_counts()
    logger.info("Training set label distribution:\n%s", label_counts.to_string())
    logger.info(
        "Duration stats after capping at %d min: median=%.1f mean=%.1f",
        MAX_DURATION_MINUTES,
        model_df["duration_minutes"].median(),
        model_df["duration_minutes"].mean(),
    )
    return model_df


def load_retraining_dataset() -> pd.DataFrame:
    database_url = get_database_url()
    if not database_url:
        return pd.DataFrame()

    import psycopg

    queries = [
        """
            select
                null::uuid as source_id,
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
        """,
        """
            select
                source_id,
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
                duration_minutes,
                impact_level
            from grievance_retraining_dataset
        """,
    ]
    rows: list[dict] = []
    for query in queries:
        try:
            with psycopg.connect(database_url, row_factory=dict_row) as conn:
                with conn.cursor() as cur:
                    cur.execute(query)
                    rows.extend(cur.fetchall())
        except Exception:
            continue

    if not rows:
        return pd.DataFrame()

    grievance_ids = [r["source_id"] for r in rows if r.get("source_id")]
    df = pd.DataFrame(rows).drop(columns=["source_id"], errors="ignore")
    df["duration_minutes"] = pd.to_numeric(df["duration_minutes"], errors="coerce")
    df = df.dropna(subset=["duration_minutes"])
    df = df[df["duration_minutes"].between(0, MAX_DURATION_MINUTES)].copy()

    # Compute derived features for retraining rows too
    df["hour"]       = pd.to_numeric(df["hour"], errors="coerce").fillna(0).astype(int)
    df["day_of_week"]= pd.to_numeric(df["day_of_week"], errors="coerce").fillna(0).astype(int)
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["rush_hour"]  = df["hour"].isin([7, 8, 9, 17, 18, 19, 20]).astype(int)

    df["log_duration"] = np.log1p(df["duration_minutes"])
    result = df[MODEL_FEATURES + ["duration_minutes", "log_duration", "impact_level"]]
    result.attrs["grievance_source_ids"] = grievance_ids
    return result


def mark_grievances_used(source_ids: list[UUID], batch_id: UUID) -> None:
    if not source_ids:
        return
    database_url = get_database_url()
    if not database_url:
        return

    import psycopg

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                update citizen_grievances
                set used_for_retraining = true,
                    retraining_batch_id = %s
                where id = any(%s)
                  and used_for_retraining = false
                """,
                (batch_id, source_ids),
            )


# ── Preprocessor ──────────────────────────────────────────────────────────────

def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_COLUMNS),
            ("num", "passthrough", NUMERIC_COLUMNS),
        ]
    )


# ── Training ──────────────────────────────────────────────────────────────────

def train_models(model_df: pd.DataFrame) -> dict[str, Any]:
    # ── Duration regression ───────────────────────────────────────────────────
    X_duration = model_df[MODEL_FEATURES]
    y_duration = model_df["log_duration"]

    X_train, X_test, y_train, y_test = train_test_split(
        X_duration, y_duration, test_size=0.2, random_state=42
    )
    duration_model = Pipeline([
        ("preprocessor", build_preprocessor()),
        ("rf", RandomForestRegressor(
            n_estimators=300,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )),
    ])
    duration_model.fit(X_train, y_train)
    duration_preds = duration_model.predict(X_test)
    dur_mae  = float(mean_absolute_error(y_test, duration_preds))
    dur_r2   = float(r2_score(y_test, duration_preds))
    logger.info("Duration model — MAE(log): %.4f  R²: %.4f", dur_mae, dur_r2)

    # ── Impact classifier ─────────────────────────────────────────────────────
    X_impact = model_df[MODEL_FEATURES]
    y_impact = model_df["impact_level"]
    stratify = y_impact if y_impact.value_counts().min() >= 2 else None
    Xc_train, Xc_test, yc_train, yc_test = train_test_split(
        X_impact, y_impact, test_size=0.2, random_state=42, stratify=stratify
    )

    impact_model = Pipeline([
        ("preprocessor", build_preprocessor()),
        ("rf", RandomForestClassifier(
            n_estimators=300,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
            class_weight="balanced",   # handles Low/Medium/High/Critical imbalance
        )),
    ])
    impact_model.fit(Xc_train, yc_train)
    impact_preds = impact_model.predict(Xc_test)

    acc    = float(accuracy_score(yc_test, impact_preds))
    f1_mac = float(f1_score(yc_test, impact_preds, average="macro"))
    report = classification_report(yc_test, impact_preds, output_dict=True)
    per_class = {
        cls: {
            "precision": round(report[cls]["precision"], 3),
            "recall":    round(report[cls]["recall"],    3),
            "f1":        round(report[cls]["f1-score"],  3),
            "support":   int(report[cls]["support"]),
        }
        for cls in ("Low", "Medium", "High", "Critical")
        if cls in report
    }
    logger.info(
        "Impact model — accuracy: %.4f  F1-macro: %.4f\n%s",
        acc, f1_mac,
        classification_report(yc_test, impact_preds),
    )

    # 5-fold cross-validated F1 for an honest estimate
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_f1 = cross_val_score(
        impact_model, X_impact, y_impact, cv=cv, scoring="f1_macro", n_jobs=-1
    )
    logger.info(
        "Impact CV F1-macro: %.4f ± %.4f  (folds: %s)",
        cv_f1.mean(), cv_f1.std(),
        [round(s, 3) for s in cv_f1],
    )

    return {
        "duration_model": duration_model,
        "impact_model":   impact_model,
        "metrics": {
            "source_rows":         int(len(model_df)),
            "duration_mae_log":    dur_mae,
            "duration_r2_log":     dur_r2,
            "impact_accuracy":     acc,
            "impact_f1_macro":     float(cv_f1.mean()),
            "impact_f1_cv_std":    float(cv_f1.std()),
            "impact_per_class":    per_class,
            "label_distribution":  model_df["impact_level"].value_counts().to_dict(),
        },
    }


# ── Artifact persistence ──────────────────────────────────────────────────────

def save_artifacts(result: dict[str, Any], output_dir: Path) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    model_version = datetime.now(timezone.utc).strftime("weekly-%Y%m%d%H%M%S")

    # Versioned copies — kept for rollback history
    duration_path         = output_dir / f"duration_model_{model_version}.pkl"
    impact_path           = output_dir / f"impact_model_{model_version}.pkl"
    metrics_path          = output_dir / f"metrics_{model_version}.json"
    duration_columns_path = output_dir / f"duration_feature_columns_{model_version}.json"
    impact_columns_path   = output_dir / f"impact_feature_columns_{model_version}.json"

    joblib.dump(result["duration_model"], duration_path)
    joblib.dump(result["impact_model"],   impact_path)
    metrics_path.write_text(json.dumps(result["metrics"], indent=2), encoding="utf-8")
    duration_columns_path.write_text(json.dumps(MODEL_FEATURES), encoding="utf-8")
    impact_columns_path.write_text(json.dumps(MODEL_FEATURES), encoding="utf-8")

    # Unversioned copies — these are what production loads at runtime
    joblib.dump(result["duration_model"], output_dir / "duration_model.pkl")
    joblib.dump(result["impact_model"],   output_dir / "impact_model.pkl")
    (output_dir / "duration_feature_columns.json").write_text(
        json.dumps(MODEL_FEATURES), encoding="utf-8"
    )
    (output_dir / "impact_feature_columns.json").write_text(
        json.dumps(MODEL_FEATURES), encoding="utf-8"
    )

    logger.info("Artifacts saved to %s (version=%s)", output_dir, model_version)
    return {
        "model_version":   model_version,
        "duration_path":   str(duration_path),
        "impact_path":     str(impact_path),
        "metrics_path":    str(metrics_path),
    }


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv",        required=True, type=Path)
    parser.add_argument("--output-dir", default=Path("app/models/candidates"), type=Path)
    args = parser.parse_args()

    logger.info("Loading Astram historical dataset from %s", args.csv)
    historical_df = load_astram_dataset(args.csv)
    logger.info("Historical rows after cleaning: %d", len(historical_df))

    retraining_df = load_retraining_dataset()
    grievance_source_ids = retraining_df.attrs.get("grievance_source_ids", [])
    logger.info("Retraining rows from DB: %d", len(retraining_df))

    model_df = pd.concat([historical_df, retraining_df], ignore_index=True)
    logger.info("Combined training rows: %d", len(model_df))

    result   = train_models(model_df)
    artifacts = save_artifacts(result, args.output_dir)

    operational_df     = build_operational_frame(args.csv)
    operational_result = train_operational_models(operational_df)
    save_operational_artifacts(operational_result, args.output_dir)

    batch_id = uuid4()
    mark_grievances_used(grievance_source_ids, batch_id)

    print(json.dumps(
        {
            "artifacts":                 artifacts,
            "metrics":                   result["metrics"],
            "operational_metrics":       operational_result["metrics"],
            "retraining_batch_id":       str(batch_id),
            "grievance_rows_consumed":   len(grievance_source_ids),
        },
        indent=2,
    ))


if __name__ == "__main__":
    main()
