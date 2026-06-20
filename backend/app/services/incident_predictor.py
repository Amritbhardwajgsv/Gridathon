"""
Incident deployment predictor.
  - llm_firewall()      : validates description via semantic similarity + Gemini
  - run_ml_only()       : XGBoost inference only (no firewall) — used by grievance_agent
  - predict_incident()  : full pipeline (firewall → ML) — used by /predict/incident endpoint
"""
from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.core.config import get_gemini_api_key, load_env_file

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"

STRUCT_FEATURES = [
    "hour", "day_of_week", "month", "is_night", "reporting_delay_min",
    "latitude", "longitude", "requires_road_closure",
    "event_cause_enc", "veh_type_enc", "corridor_enc",
    "police_station_enc", "zone_enc",
]
EMB_DIM            = 384
TRANSFORMER_FEATURES = [f"emb_{i}" for i in range(EMB_DIM)]
ALL_FEATURES       = STRUCT_FEATURES + TRANSFORMER_FEATURES

_FW_PASS_THRESHOLD   = 0.50
_FW_REJECT_THRESHOLD = 0.15

_TRAFFIC_ANCHORS = [
    "heavy truck stalled on highway blocking traffic",
    "vehicle breakdown on national highway requiring tow truck",
    "tree fallen across road causing traffic blockage",
    "accident between vehicles creating traffic jam",
    "road construction causing traffic diversion",
    "traffic signal malfunction causing heavy congestion",
    "bus breakdown blocking main road",
    "waterlogging on road due to rain causing traffic jam",
    "VIP convoy movement causing road closure",
    "large event causing severe traffic congestion near junction",
    "ಮರ ಬಿದ್ದಿದೆ ರಸ್ತೆ ಬ್ಲಾಕ್ ಆಗಿದೆ",
    "ವಾಹನ ತಾಂತ್ರಿಕ ದೋಷ ರಸ್ತೆ ಮೇಲೆ ನಿಂತಿದೆ",
    "ಅಪಘಾತ ಆಗಿದೆ ರಸ್ತೆ ಮುಚ್ಚಿದೆ",
]

EVENT_CAUSE_KEYWORDS: dict[str, list[str]] = {
    "vehicle_breakdown": ["breakdown", "stalled", "engine failure", "broken down",
                          "puncture", "flat tyre", "flat tire", "battery dead"],
    "tree_fall":         ["tree", "fallen tree", "tree down", "tree fall", "tree branch"],
    "accident":          ["accident", "collision", "crash", "hit and run", "knocked"],
    "road_work":         ["road work", "construction", "digging", "repair", "maintenance"],
    "signal_failure":    ["signal", "traffic light", "traffic signal", "signal failure"],
    "flooding":          ["flood", "water logging", "waterlogging", "rain", "submerged"],
    "protest":           ["protest", "demonstration", "rally", "march", "bandh", "strike"],
    "vip_movement":      ["vip", "vvip", "convoy", "security convoy", "motorcade"],
    "event_congestion":  ["event", "concert", "match", "gathering", "festival", "procession"],
}

VEH_TYPE_KEYWORDS: dict[str, list[str]] = {
    "heavy_vehicle": ["truck", "lorry", "heavy vehicle", "tanker", "trailer", "container"],
    "lcv":           ["mini truck", "pickup", "lcv", "light commercial"],
    "bmtc_bus":      ["bmtc", "government bus", "kstrc"],
    "bus":           ["bus", "coach", "volvo"],
    "two_wheeler":   ["bike", "motorcycle", "scooter", "two wheeler", "moped"],
    "car":           ["car", "sedan", "suv", "hatchback", "taxi", "cab", "auto"],
}

# ─── Singleton state ───────────────────────────────────────────────────────────

_lock             = threading.Lock()
_dur_model: Any   = None
_pri_model: Any   = None
_le: dict         = {}
_embedder: Any    = None
_anchor_embs: Any = None


def _load_models() -> None:
    global _dur_model, _pri_model, _le, _embedder, _anchor_embs
    if _dur_model is not None:
        return
    import joblib
    from sentence_transformers import SentenceTransformer

    _dur_model   = joblib.load(MODELS_DIR / "duration_model.pkl")
    _pri_model   = joblib.load(MODELS_DIR / "resource_model.pkl")
    _le          = joblib.load(MODELS_DIR / "label_encoders.pkl")
    model_name = os.getenv(
        "SENTENCE_TRANSFORMER_MODEL",
        "paraphrase-multilingual-MiniLM-L12-v2",
    )
    _embedder    = SentenceTransformer(model_name)
    _anchor_embs = _embedder.encode(_TRAFFIC_ANCHORS, normalize_embeddings=True)


def _ensure_loaded() -> None:
    if _dur_model is not None:
        return
    with _lock:
        _load_models()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _extract_event_cause(text: str) -> str | None:
    for cause, kws in EVENT_CAUSE_KEYWORDS.items():
        if any(kw in text for kw in kws):
            return cause
    return None


def _extract_veh_type(text: str) -> str | None:
    for vtype, kws in VEH_TYPE_KEYWORDS.items():
        if any(kw in text for kw in kws):
            return vtype
    return None


def _safe_encode(encoder: Any, value: str) -> int:
    if value in set(encoder.classes_):
        return int(encoder.transform([value])[0])
    return int(encoder.transform([encoder.classes_[0]])[0])


def _get_personnel(priority_pred: int, duration_min: float, road_closure: bool) -> int:
    base = 1
    if priority_pred == 1: base += 1
    if road_closure:        base += 1
    if duration_min > 240:  base += 1
    if duration_min > 480:  base += 1
    return base


def _get_urgency(priority_pred: int, duration_min: float, road_closure: bool) -> str:
    if priority_pred == 1 and duration_min > 240:                    return "CRITICAL"
    if priority_pred == 1 or (road_closure and duration_min > 120):  return "HIGH"
    if duration_min > 120:                                           return "MEDIUM"
    return "LOW"


def _cosine_max(query_emb: np.ndarray) -> float:
    q    = query_emb / (np.linalg.norm(query_emb) + 1e-9)
    sims = _anchor_embs @ q
    return float(np.max(sims))


# ─── LLM Firewall ─────────────────────────────────────────────────────────────

def llm_firewall(description: str, emb: np.ndarray) -> tuple[bool, str]:
    """Returns (is_valid, reason). Uses Gemini for the uncertain zone."""
    sim = _cosine_max(emb)

    if sim >= _FW_PASS_THRESHOLD:
        return True, f"Semantic match (sim={sim:.2f})"

    if sim < _FW_REJECT_THRESHOLD:
        return False, "Input does not describe a road traffic incident."

    # Uncertain zone → Gemini
    load_env_file()
    key = get_gemini_api_key()
    if not key:
        return True, f"Borderline (sim={sim:.2f}); Gemini key not configured"

    try:
        from google import genai
        client   = genai.Client(api_key=key)
        response = client.models.generate_content(
            model    = "gemini-2.0-flash-lite",
            contents = (
                "Is the following description about a road traffic incident "
                "(breakdown, accident, congestion, tree fall, signal failure, flooding, etc.)? "
                "Reply with exactly one word: YES or NO.\n\n"
                f"Description: {description[:500]}"
            ),
        )
        answer = (response.text or "").strip().upper()
        if answer.startswith("YES"):
            return True, f"Gemini validated (sim={sim:.2f})"
        return False, "Gemini determined the description is not a traffic incident."
    except Exception as exc:
        # Gemini unavailable (rate limit, network, etc.) — reject uncertain-zone input
        # rather than fail open. Clear traffic incidents already passed at sim >= 0.50.
        return False, "Description could not be validated as a traffic incident. Please describe the road situation clearly."


# ─── ML-only inference (used by grievance_agent after firewall already passed) ─

def run_ml_only(
    description: str,
    latitude: float,
    longitude: float,
    requires_road_closure: bool = False,
    event_cause: str    = "others",
    veh_type: str       = "unknown",
    corridor: str       = "Non-corridor",
    police_station: str = "unknown",
    zone: str           = "unknown",
    hour: int | None    = None,
    day_of_week: int | None = None,
    month: int | None   = None,
) -> dict:
    """Pure ML inference — no firewall. Returns prediction dict."""
    _ensure_loaded()

    import datetime
    now = datetime.datetime.now()
    if hour        is None: hour        = now.hour
    if day_of_week is None: day_of_week = now.weekday()
    if month       is None: month       = now.month

    emb = _embedder.encode([description])[0]

    desc_lower = description.lower()
    if event_cause == "others":
        nlp = _extract_event_cause(desc_lower)
        if nlp: event_cause = nlp
    if veh_type == "unknown":
        nlp = _extract_veh_type(desc_lower)
        if nlp: veh_type = nlp

    struct_row = {
        "hour"                 : hour,
        "day_of_week"          : day_of_week,
        "month"                : month,
        "is_night"             : 1 if (hour >= 21 or hour <= 6) else 0,
        "reporting_delay_min"  : 0,
        "latitude"             : latitude,
        "longitude"            : longitude,
        "requires_road_closure": int(requires_road_closure),
        "event_cause_enc"      : _safe_encode(_le["event_cause"],    event_cause),
        "veh_type_enc"         : _safe_encode(_le["veh_type"],       veh_type),
        "corridor_enc"         : _safe_encode(_le["corridor"],        corridor),
        "police_station_enc"   : _safe_encode(_le["police_station"], police_station),
        "zone_enc"             : _safe_encode(_le["zone"],            zone),
    }
    emb_row = {f"emb_{i}": float(emb[i]) for i in range(len(emb))}
    X = pd.DataFrame([{**struct_row, **emb_row}])[ALL_FEATURES]

    duration_min  = float(_dur_model.predict(X)[0])
    priority_pred = int(_pri_model.predict(X)[0])
    personnel     = _get_personnel(priority_pred, duration_min, requires_road_closure)
    urgency       = _get_urgency(priority_pred, duration_min, requires_road_closure)

    return {
        "estimated_duration_min": round(duration_min, 1),
        "estimated_duration_hrs": round(duration_min / 60, 2),
        "priority"              : "High" if priority_pred == 1 else "Low",
        "personnel_to_deploy"   : personnel,
        "urgency"               : urgency,
        "detected_cause"        : event_cause,
        "detected_veh_type"     : veh_type,
    }


# ─── Full pipeline (firewall + ML) ────────────────────────────────────────────

def predict_incident(
    description: str,
    latitude: float,
    longitude: float,
    requires_road_closure: bool = False,
    **kwargs,
) -> dict:
    """Full pipeline: LLM firewall → ML inference."""
    _ensure_loaded()

    emb = _embedder.encode([description])[0]
    is_valid, fw_reason = llm_firewall(description, emb)

    if not is_valid:
        return {
            "status"  : "REJECTED",
            "firewall": {"passed": False, "reason": fw_reason, "incident_type": None},
        }

    ml = run_ml_only(description, latitude, longitude, requires_road_closure, **kwargs)

    return {
        "status"  : "OK",
        "firewall": {"passed": True, "reason": fw_reason, "incident_type": None},
        **ml,
    }
