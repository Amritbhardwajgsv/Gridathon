"""
Retrain XGBoost duration regressor + priority classifier with real HuggingFace embeddings.

Usage:
    cd backend
    pip install xgboost scikit-learn pandas numpy joblib huggingface_hub
    HF_API_KEY=hf_xxx python ml/train_xgboost_with_embeddings.py \
        --csv "../Astram event data_anonymized - Astram event data_anonymizedb40ac87 (2).csv" \
        --output app/models

Embeddings are cached to embeddings_cache.npy + embeddings_cache_ids.npy so
the script can be interrupted and resumed without re-calling HuggingFace.
"""
from __future__ import annotations

import argparse
import os
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

# ── Constants matching incident_predictor.py ──────────────────────────────────
HF_MODEL  = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
EMB_DIM   = 384
BATCH_SZ  = 32   # texts per HF API call — free tier handles this fine

STRUCT_FEATURES = [
    "hour", "day_of_week", "month", "is_night", "reporting_delay_min",
    "latitude", "longitude", "requires_road_closure",
    "event_cause_enc", "veh_type_enc", "corridor_enc",
    "police_station_enc", "zone_enc",
]
EMB_FEATURES = [f"emb_{i}" for i in range(EMB_DIM)]
ALL_FEATURES = STRUCT_FEATURES + EMB_FEATURES

# ── Cause normalisation map ───────────────────────────────────────────────────
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

# ── Veh type normalisation map ────────────────────────────────────────────────
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


# ── HuggingFace embedding with batching + retry ───────────────────────────────

def get_embeddings(texts: list[str], hf_key: str) -> np.ndarray:
    """Return float32 array of shape (len(texts), EMB_DIM)."""
    from huggingface_hub import InferenceClient
    client = InferenceClient(model=HF_MODEL, token=hf_key)

    results = np.zeros((len(texts), EMB_DIM), dtype=np.float32)
    total_batches = (len(texts) + BATCH_SZ - 1) // BATCH_SZ

    for batch_idx in range(total_batches):
        start = batch_idx * BATCH_SZ
        end   = min(start + BATCH_SZ, len(texts))
        batch = texts[start:end]

        # replace empty/null with a space so the model gets something
        batch = [t if t and t.strip() else " " for t in batch]

        for attempt in range(5):
            try:
                raw = client.feature_extraction(batch, normalize=True)
                arr = np.array(raw, dtype=np.float32)
                if arr.ndim == 1:
                    arr = arr.reshape(1, -1)
                results[start:end] = arr
                break
            except Exception as exc:
                wait = 2 ** attempt
                print(f"  Batch {batch_idx+1}/{total_batches} attempt {attempt+1} failed: {exc} — retrying in {wait}s")
                time.sleep(wait)
        else:
            print(f"  Batch {batch_idx+1}/{total_batches} FAILED after 5 attempts — zero-padding")

        if (batch_idx + 1) % 10 == 0 or batch_idx == total_batches - 1:
            pct = (batch_idx + 1) / total_batches * 100
            print(f"  Embeddings: {batch_idx+1}/{total_batches} batches ({pct:.0f}%)")

    return results


# ── Data loading & feature engineering ───────────────────────────────────────

def load_and_clean(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} rows")

    # drop test rows
    df = df[df["event_cause"] != "test_demo"].copy()

    # parse datetimes
    for col in ["start_datetime", "end_datetime", "closed_datetime", "resolved_datetime"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", utc=True)

    # duration (minutes)
    completion = df[["end_datetime", "closed_datetime", "resolved_datetime"]].bfill(axis=1).iloc[:, 0]
    df["duration_minutes"] = (completion - df["start_datetime"]).dt.total_seconds() / 60

    # reporting delay (minutes from created to start)
    if "created_date" in df.columns:
        df["created_date"] = pd.to_datetime(df["created_date"], errors="coerce", utc=True)
        df["reporting_delay_min"] = (
            (df["start_datetime"] - df["created_date"]).dt.total_seconds() / 60
        ).clip(lower=0).fillna(0)
    else:
        df["reporting_delay_min"] = 0.0

    # time features
    df["hour"]        = df["start_datetime"].dt.hour
    df["day_of_week"] = df["start_datetime"].dt.dayofweek
    df["month"]       = df["start_datetime"].dt.month
    df["is_night"]    = ((df["hour"] >= 21) | (df["hour"] <= 6)).astype(int)

    # road closure
    df["requires_road_closure"] = df["requires_road_closure"].astype(str).str.upper().map(
        {"TRUE": 1, "FALSE": 0}
    ).fillna(0).astype(int)

    # normalise categoricals
    df["event_cause_raw"] = df["event_cause"].fillna("others").map(
        lambda x: _CAUSE_MAP.get(x, "others")
    )
    df["veh_type_raw"] = df["veh_type"].fillna("unknown").map(
        lambda x: _VEH_MAP.get(x, "unknown")
    )
    df["corridor_raw"]       = df["corridor"].fillna("Non-corridor").astype(str)
    df["police_station_raw"] = df["police_station"].fillna("unknown").astype(str)
    df["zone_raw"]           = df["zone"].fillna("unknown").astype(str)

    # binary priority label
    df["priority_bin"] = (df["priority"].str.strip().str.capitalize() == "High").astype(int)

    # filter valid rows
    df = df[
        df["duration_minutes"].between(1, 1440) &
        df["latitude"].between(-90, 90) &
        df["longitude"].between(-180, 180)
    ].copy()

    df["description"] = df["description"].fillna("").astype(str)

    print(f"After cleaning: {len(df)} rows")
    print(f"  High priority: {df['priority_bin'].sum()} | Low: {(df['priority_bin']==0).sum()}")
    print(f"  Duration range: {df['duration_minutes'].min():.0f}–{df['duration_minutes'].max():.0f} min")
    return df.reset_index(drop=True)


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
        print(f"  Encoder '{col}': {len(le.classes_)} classes")
    return encoders


# ── Training ──────────────────────────────────────────────────────────────────

def train(df: pd.DataFrame, embeddings: np.ndarray) -> tuple:
    import xgboost as xgb
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, mean_absolute_error

    X = pd.DataFrame(
        np.hstack([
            df[STRUCT_FEATURES].values.astype(np.float32),
            embeddings.astype(np.float32),
        ]),
        columns=ALL_FEATURES,
    )
    y_duration = df["duration_minutes"].values.astype(np.float32)
    y_priority = df["priority_bin"].values.astype(int)

    X_tr, X_te, yd_tr, yd_te, yp_tr, yp_te = train_test_split(
        X, y_duration, y_priority, test_size=0.15, random_state=42, stratify=y_priority
    )

    print("\nTraining XGBoost duration regressor …")
    dur_model = xgb.XGBRegressor(
        n_estimators=400,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        random_state=42,
        n_jobs=-1,
        verbosity=0,
    )
    dur_model.fit(X_tr, yd_tr, eval_set=[(X_te, yd_te)], verbose=False)
    dur_preds = dur_model.predict(X_te)
    print(f"  Duration MAE: {mean_absolute_error(yd_te, dur_preds):.1f} min")

    print("Training XGBoost priority classifier …")
    pri_model = xgb.XGBClassifier(
        n_estimators=400,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        scale_pos_weight=(yp_tr == 0).sum() / max((yp_tr == 1).sum(), 1),
        random_state=42,
        n_jobs=-1,
        verbosity=0,
        eval_metric="logloss",
    )
    pri_model.fit(X_tr, yp_tr, eval_set=[(X_te, yp_te)], verbose=False)
    pri_preds = pri_model.predict(X_te)
    print(f"  Priority accuracy: {accuracy_score(yp_te, pri_preds)*100:.1f}%")

    return dur_model, pri_model


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv",    required=True, type=Path)
    parser.add_argument("--output", default=Path("app/models"), type=Path)
    parser.add_argument("--cache",  default=Path("ml/embeddings_cache"), type=Path,
                        help="Prefix for .npy cache files (no extension)")
    args = parser.parse_args()

    hf_key = os.getenv("HF_API_KEY", "")
    if not hf_key:
        print("ERROR: Set HF_API_KEY env var before running")
        return

    # 1. Load data
    df = load_and_clean(args.csv)

    # 2. Fit label encoders
    print("\nFitting label encoders …")
    encoders = fit_encoders(df)

    # encode into df
    df["event_cause_enc"]    = encoders["event_cause"].transform(df["event_cause_raw"])
    df["veh_type_enc"]       = encoders["veh_type"].transform(df["veh_type_raw"])
    df["corridor_enc"]       = encoders["corridor"].transform(df["corridor_raw"])
    df["police_station_enc"] = encoders["police_station"].transform(df["police_station_raw"])
    df["zone_enc"]           = encoders["zone"].transform(df["zone_raw"])

    # 3. Embeddings (with cache)
    emb_path     = Path(str(args.cache) + ".npy")
    emb_ids_path = Path(str(args.cache) + "_ids.npy")

    if emb_path.exists() and emb_ids_path.exists():
        cached_ids = np.load(emb_ids_path, allow_pickle=True).tolist()
        if cached_ids == df.index.tolist():
            print(f"\nLoading cached embeddings from {emb_path}")
            embeddings = np.load(emb_path)
        else:
            print("\nCache mismatch — recomputing embeddings …")
            embeddings = None
    else:
        embeddings = None

    if embeddings is None:
        print(f"\nComputing {len(df)} embeddings in batches of {BATCH_SZ} …")
        print("This will take a few minutes on HuggingFace free tier.\n")
        embeddings = get_embeddings(df["description"].tolist(), hf_key)
        np.save(emb_path,     embeddings)
        np.save(emb_ids_path, np.array(df.index.tolist()))
        print(f"Embeddings cached to {emb_path}")

    # 4. Train
    dur_model, pri_model = train(df, embeddings)

    # 5. Save
    args.output.mkdir(parents=True, exist_ok=True)
    joblib.dump(dur_model, args.output / "duration_model.pkl")
    joblib.dump(pri_model, args.output / "resource_model.pkl")
    joblib.dump(encoders,  args.output / "label_encoders.pkl")
    print(f"\nSaved models to {args.output}/")
    print("  duration_model.pkl")
    print("  resource_model.pkl")
    print("  label_encoders.pkl")
    print("\nDone. Redeploy Railway to pick up the new models.")


if __name__ == "__main__":
    main()
