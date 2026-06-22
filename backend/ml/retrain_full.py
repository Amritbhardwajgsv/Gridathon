"""
Full retraining script — uses all 2718 clean rows + cached embeddings.
No HuggingFace calls needed (embeddings already cached).

Usage (from repo root):
    cd backend
    python ml/retrain_full.py

Outputs to app/model/ (overwriting previous models).
"""
from __future__ import annotations

import io
import json
import os
import sys
import time
from pathlib import Path

# Windows cp1252 fix
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, classification_report, mean_absolute_error,
    mean_absolute_percentage_error, roc_auc_score, f1_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.preprocessing import LabelEncoder

ROOT     = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "Astram event data_anonymized - Astram event data_anonymizedb40ac87 (2).csv"
EMB_NPY  = Path(__file__).parent / "embeddings_cache.npy"
EMB_IDS  = Path(__file__).parent / "embeddings_cache_ids.npy"
OUT_DIR  = Path(__file__).resolve().parents[1] / "app" / "model"

EMB_DIM = 384

_CAUSE_MAP = {
    "vehicle_breakdown": "vehicle_breakdown",
    "accident":          "accident",
    "tree_fall":         "tree_fall",
    "road_conditions":   "road_conditions",
    "pot_holes":         "road_conditions",
    "construction":      "road_conditions",
    "water_logging":     "flooding",
    "flooding":          "flooding",
    "congestion":        "others",
    "public_event":      "public_event",
    "procession":        "procession",
    "vip_movement":      "vip_movement",
    "protest":           "protest",
    "signal_failure":    "signal_failure",
    "debris":            "others",
    "Debris":            "others",
    "test_demo":         "others",
    "Fog / Low Visibility": "others",
    "others":            "others",
}
_VEH_MAP = {
    "bmtc_bus":      "bmtc_bus",
    "ksrtc_bus":     "bus",
    "private_bus":   "bus",
    "bus":           "bus",
    "heavy_vehicle": "heavy_vehicle",
    "truck":         "heavy_vehicle",
    "lcv":           "lcv",
    "private_car":   "car",
    "taxi":          "car",
    "auto":          "car",
    "car":           "car",
    "two_wheeler":   "two_wheeler",
    "others":        "unknown",
}

# ── EDA-derived corridor risk scores ─────────────────────────────────────────
_CORRIDOR_RISK_CSV = Path(__file__).parent / "corridor_risk_scores.csv"


def _load_corridor_risk() -> dict[str, float]:
    if not _CORRIDOR_RISK_CSV.exists():
        return {}
    cr = pd.read_csv(_CORRIDOR_RISK_CSV)
    return dict(zip(cr["corridor"].str.lower(), cr["high_priority_pct"] / 100))


# ─────────────────────────────────────────────────────────────────────────────

def load_and_engineer(csv_path: Path, corridor_risk: dict) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df = df[df["event_cause"] != "test_demo"].copy()
    print(f"Loaded {len(df):,} rows (after removing test_demo)")

    for col in ["start_datetime", "end_datetime", "closed_datetime",
                "resolved_datetime", "created_date"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", utc=True)

    # Duration — use best available end timestamp
    completion = df[["end_datetime", "closed_datetime", "resolved_datetime"]].bfill(axis=1).iloc[:, 0]
    df["duration_minutes"] = (completion - df["start_datetime"]).dt.total_seconds() / 60

    # Reporting delay
    df["reporting_delay_min"] = (
        (df["start_datetime"] - df["created_date"]).dt.total_seconds() / 60
    ).clip(lower=0).fillna(0)

    # Time features
    df["hour"]        = df["start_datetime"].dt.hour
    df["day_of_week"] = df["start_datetime"].dt.dayofweek
    df["month"]       = df["start_datetime"].dt.month
    df["is_night"]    = ((df["hour"] >= 20) | (df["hour"] <= 6)).astype(int)
    df["is_peak_am"]  = df["hour"].between(4, 7).astype(int)
    df["is_peak_pm"]  = df["hour"].between(19, 22).astype(int)

    # Road closure
    df["requires_road_closure"] = (
        df["requires_road_closure"].astype(str).str.upper()
        .map({"TRUE": 1, "FALSE": 0}).fillna(0).astype(int)
    )

    # Normalise categoricals
    df["event_cause_raw"]    = df["event_cause"].fillna("others").map(lambda x: _CAUSE_MAP.get(x, "others"))
    df["veh_type_raw"]       = df["veh_type"].fillna("unknown").map(lambda x: _VEH_MAP.get(x, "unknown"))
    df["corridor_raw"]       = df["corridor"].fillna("Non-corridor").astype(str)
    df["police_station_raw"] = df["police_station"].fillna("unknown").astype(str)
    df["zone_raw"]           = df["zone"].fillna("unknown").astype(str)

    # EDA-derived corridor risk (continuous feature)
    df["corridor_risk"] = df["corridor_raw"].str.lower().map(corridor_risk).fillna(0.5)

    # Target
    df["priority_bin"] = (df["priority"].str.strip().str.capitalize() == "High").astype(int)

    # Filter quality rows
    df = df[
        df["duration_minutes"].between(1, 1440) &
        df["latitude"].between(6, 38) &
        df["longitude"].between(68, 98)
    ].copy()

    df["description"] = df["description"].fillna("").astype(str)
    df = df.reset_index(drop=True)

    print(f"After quality filter: {len(df):,} rows")
    print(f"  High={df['priority_bin'].sum():,}  Low={(df['priority_bin']==0).sum():,}  "
          f"Balance={df['priority_bin'].mean()*100:.1f}% High")
    return df


STRUCT_FEATURES = [
    "hour", "day_of_week", "month", "is_night", "is_peak_am", "is_peak_pm",
    "reporting_delay_min", "latitude", "longitude",
    "requires_road_closure", "corridor_risk",
    "event_cause_enc", "veh_type_enc", "corridor_enc",
    "police_station_enc", "zone_enc",
]
EMB_FEATURES = [f"emb_{i}" for i in range(EMB_DIM)]
ALL_FEATURES  = STRUCT_FEATURES + EMB_FEATURES


def fit_encoders(df: pd.DataFrame) -> dict[str, LabelEncoder]:
    encoders: dict[str, LabelEncoder] = {}
    for col, raw in [
        ("event_cause",    "event_cause_raw"),
        ("veh_type",       "veh_type_raw"),
        ("corridor",       "corridor_raw"),
        ("police_station", "police_station_raw"),
        ("zone",           "zone_raw"),
    ]:
        le = LabelEncoder()
        le.fit(df[raw])
        encoders[col] = le
        print(f"  {col}: {len(le.classes_)} classes")
    return encoders


def build_feature_matrix(df: pd.DataFrame, embeddings: np.ndarray) -> np.ndarray:
    struct = df[STRUCT_FEATURES].values.astype(np.float32)
    return np.hstack([struct, embeddings.astype(np.float32)])


# ── XGBoost hyperparameters (tuned for ~2700 rows, 397 features) ─────────────

PRIORITY_PARAMS = dict(
    n_estimators        = 800,
    max_depth           = 5,
    learning_rate       = 0.03,
    subsample           = 0.80,
    colsample_bytree    = 0.65,
    colsample_bylevel   = 0.80,
    min_child_weight    = 8,
    gamma               = 0.15,
    reg_alpha           = 0.20,   # L1 — helps with 384 sparse emb dims
    reg_lambda          = 1.50,   # L2
    random_state        = 42,
    n_jobs              = -1,
    verbosity           = 0,
    eval_metric         = "auc",
    early_stopping_rounds = 40,
)

DURATION_PARAMS = dict(
    n_estimators        = 800,
    max_depth           = 5,
    learning_rate       = 0.03,
    subsample           = 0.80,
    colsample_bytree    = 0.65,
    colsample_bylevel   = 0.80,
    min_child_weight    = 8,
    gamma               = 0.15,
    reg_alpha           = 0.20,
    reg_lambda          = 1.50,
    random_state        = 42,
    n_jobs              = -1,
    verbosity           = 0,
    early_stopping_rounds = 40,
)


def train_and_evaluate(X: np.ndarray, y_priority: np.ndarray,
                       y_duration: np.ndarray) -> tuple:
    import xgboost as xgb

    # Held-out test split (stratified)
    X_tr, X_te, yp_tr, yp_te, yd_tr, yd_te = train_test_split(
        X, y_priority, y_duration,
        test_size=0.15, random_state=42, stratify=y_priority,
    )

    spw = (yp_tr == 0).sum() / max((yp_tr == 1).sum(), 1)

    # ── Priority classifier ──────────────────────────────────────────────────
    print("\n--- Priority Classifier ---")
    pri_model = xgb.XGBClassifier(
        scale_pos_weight=spw,
        **{k: v for k, v in PRIORITY_PARAMS.items()},
    )
    pri_model.fit(
        X_tr, yp_tr,
        eval_set=[(X_te, yp_te)],
        verbose=False,
    )
    yp_pred  = pri_model.predict(X_te)
    yp_prob  = pri_model.predict_proba(X_te)[:, 1]
    print(classification_report(yp_te, yp_pred, target_names=["Low","High"], digits=3))
    print(f"  ROC-AUC  : {roc_auc_score(yp_te, yp_prob):.4f}")
    print(f"  F1 (High): {f1_score(yp_te, yp_pred):.4f}")
    print(f"  Best iter: {pri_model.best_iteration}")

    # ── Duration regressor ───────────────────────────────────────────────────
    print("\n--- Duration Regressor ---")
    dur_model = xgb.XGBRegressor(**{k: v for k, v in DURATION_PARAMS.items()})
    dur_model.fit(
        X_tr, yd_tr,
        eval_set=[(X_te, yd_te)],
        verbose=False,
    )
    yd_pred = dur_model.predict(X_te)
    mae     = mean_absolute_error(yd_te, yd_pred)
    mape    = mean_absolute_percentage_error(yd_te + 1, yd_pred + 1) * 100
    med_ae  = np.median(np.abs(yd_te - yd_pred))
    print(f"  MAE        : {mae:.1f} min")
    print(f"  Median AE  : {med_ae:.1f} min")
    print(f"  MAPE       : {mape:.1f}%")
    print(f"  Best iter  : {dur_model.best_iteration}")

    # ── Cross-validation (priority only — quick 5-fold) ──────────────────────
    print("\n--- 5-fold Stratified CV (priority) ---")
    cv   = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    aucs, f1s = [], []
    for fold, (tr_idx, va_idx) in enumerate(cv.split(X, y_priority)):
        best_n = pri_model.best_iteration or 400
        cv_params = {k: v for k, v in PRIORITY_PARAMS.items()
                     if k not in ("early_stopping_rounds", "n_estimators")}
        m = xgb.XGBClassifier(
            n_estimators=best_n,
            scale_pos_weight=(y_priority[tr_idx]==0).sum() /
                              max((y_priority[tr_idx]==1).sum(), 1),
            **cv_params,
        )
        m.fit(X[tr_idx], y_priority[tr_idx], verbose=False)
        prob = m.predict_proba(X[va_idx])[:, 1]
        pred = m.predict(X[va_idx])
        aucs.append(roc_auc_score(y_priority[va_idx], prob))
        f1s.append(f1_score(y_priority[va_idx], pred))
        print(f"  Fold {fold+1}: AUC={aucs[-1]:.4f}  F1={f1s[-1]:.4f}")
    print(f"  Mean AUC : {np.mean(aucs):.4f} ± {np.std(aucs):.4f}")
    print(f"  Mean F1  : {np.mean(f1s):.4f} ± {np.std(f1s):.4f}")

    return pri_model, dur_model


def save_feature_importance(pri_model, dur_model,
                            feature_names: list[str], out_dir: Path) -> None:
    for model, name in [(pri_model, "priority"), (dur_model, "duration")]:
        imp = model.feature_importances_
        top = sorted(zip(feature_names, imp), key=lambda x: -x[1])[:20]
        print(f"\nTop 10 features ({name}):")
        for feat, score in top[:10]:
            bar = "█" * int(score * 500)
            print(f"  {feat:<30} {score:.5f}  {bar}")
        df_imp = pd.DataFrame(top, columns=["feature", "importance"])
        df_imp.to_csv(out_dir / f"feature_importance_{name}.csv", index=False)


# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    t0 = time.time()

    if not CSV_PATH.exists():
        sys.exit(f"CSV not found: {CSV_PATH}")
    if not EMB_NPY.exists():
        sys.exit(f"Embedding cache not found: {EMB_NPY}\nRun the original training script first.")

    print("=" * 60)
    print("DRISHTI — Full XGBoost Retrain")
    print("=" * 60)

    # 1. Load
    corridor_risk = _load_corridor_risk()
    print(f"\nLoaded {len(corridor_risk)} corridor risk scores from EDA")
    df = load_and_engineer(CSV_PATH, corridor_risk)

    # 2. Encoders
    print("\nFitting label encoders …")
    encoders = fit_encoders(df)
    df["event_cause_enc"]    = encoders["event_cause"].transform(df["event_cause_raw"])
    df["veh_type_enc"]       = encoders["veh_type"].transform(df["veh_type_raw"])
    df["corridor_enc"]       = encoders["corridor"].transform(df["corridor_raw"])
    df["police_station_enc"] = encoders["police_station"].transform(df["police_station_raw"])
    df["zone_enc"]           = encoders["zone"].transform(df["zone_raw"])

    # 3. Load cached embeddings — align with df
    print(f"\nLoading embeddings from {EMB_NPY} …")
    cached_emb = np.load(EMB_NPY)
    cached_ids = np.load(EMB_IDS, allow_pickle=True).tolist()
    id_to_row  = {int(i): r for r, i in enumerate(cached_ids)}
    embeddings = np.zeros((len(df), EMB_DIM), dtype=np.float32)
    matched = 0
    for pos, orig_idx in enumerate(df.index):
        if orig_idx in id_to_row:
            embeddings[pos] = cached_emb[id_to_row[orig_idx]]
            matched += 1
    print(f"Matched {matched}/{len(df)} rows from embedding cache "
          f"({matched/len(df)*100:.1f}%)")

    # 4. Build feature matrix
    X          = build_feature_matrix(df, embeddings)
    y_priority = df["priority_bin"].values.astype(int)
    y_duration = df["duration_minutes"].values.astype(np.float32)
    print(f"\nFeature matrix: {X.shape}  "
          f"({len(STRUCT_FEATURES)} structural + {EMB_DIM} embedding)")

    # 5. Train & evaluate
    pri_model, dur_model = train_and_evaluate(X, y_priority, y_duration)

    # 6. Save
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pri_model, OUT_DIR / "resource_model.pkl")
    joblib.dump(dur_model, OUT_DIR / "duration_model.pkl")
    joblib.dump(encoders,  OUT_DIR / "label_encoders.pkl")

    meta = {
        "train_rows":       len(df),
        "n_features":       X.shape[1],
        "struct_features":  STRUCT_FEATURES,
        "priority_params":  {k: v for k, v in PRIORITY_PARAMS.items()
                             if k != "early_stopping_rounds"},
        "duration_params":  {k: v for k, v in DURATION_PARAMS.items()
                             if k != "early_stopping_rounds"},
        "priority_best_iter": int(pri_model.best_iteration or 0),
        "duration_best_iter": int(dur_model.best_iteration or 0),
    }
    (OUT_DIR / "model_meta.json").write_text(json.dumps(meta, indent=2))

    save_feature_importance(pri_model, dur_model, ALL_FEATURES, OUT_DIR)

    elapsed = time.time() - t0
    print(f"\n" + "="*60)
    print(f"Saved to {OUT_DIR}/")
    print(f"  resource_model.pkl")
    print(f"  duration_model.pkl")
    print(f"  label_encoders.pkl")
    print(f"  model_meta.json")
    print(f"  feature_importance_priority.csv")
    print(f"  feature_importance_duration.csv")
    print(f"\nTotal time: {elapsed:.0f}s")
    print("Commit app/model/ and redeploy Railway to use the new models.")


if __name__ == "__main__":
    main()
