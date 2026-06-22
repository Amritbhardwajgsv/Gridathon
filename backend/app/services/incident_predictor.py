"""
Incident deployment predictor.
  - llm_firewall()      : validates description via keyword filter + Gemini (no local model)
  - run_ml_only()       : XGBoost inference only (no firewall) — used by grievance_agent
  - predict_incident()  : full pipeline (firewall → ML) — used by /predict/incident endpoint

SentenceTransformer has been removed to fit within Render free-tier 512MB RAM.
Embedding features are zero-padded for XGBoost; structural features carry the prediction.
"""
from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

import pandas as pd

from app.core.config import get_gemini_api_key, load_env_file

MODELS_DIR = Path(__file__).resolve().parents[1] / "model"

STRUCT_FEATURES = [
    "hour", "day_of_week", "month", "is_night", "is_peak_am", "is_peak_pm",
    "reporting_delay_min", "latitude", "longitude",
    "requires_road_closure", "corridor_risk",
    "event_cause_enc", "veh_type_enc", "corridor_enc",
    "police_station_enc", "zone_enc",
]
EMB_DIM              = 384
TRANSFORMER_FEATURES = [f"emb_{i}" for i in range(EMB_DIM)]
ALL_FEATURES         = STRUCT_FEATURES + TRANSFORMER_FEATURES

# ── Corridor risk lookup (from EDA) ──────────────────────────────────────────
import csv as _csv_mod

def _load_corridor_risk() -> dict[str, float]:
    path = Path(__file__).resolve().parents[1] / "ml" / "corridor_risk_scores.csv"
    if not path.exists():
        return {}
    result: dict[str, float] = {}
    with open(path, newline="") as f:
        for row in _csv_mod.DictReader(f):
            name = row.get("corridor", "").strip().lower()
            pct  = row.get("high_priority_pct", row.get("high_pct", "0.5"))
            try:
                result[name] = float(pct)
            except ValueError:
                pass
    return result

_CORRIDOR_RISK: dict[str, float] = {}

def _get_corridor_risk(corridor: str) -> float:
    global _CORRIDOR_RISK
    if not _CORRIDOR_RISK:
        _CORRIDOR_RISK = _load_corridor_risk()
    return _CORRIDOR_RISK.get(corridor.strip().lower(), 0.5)

_GEMINI_TIMEOUT_S = 20

# Keyword pre-filter — instant rejection before any API call.
# Descriptions with none of these words cannot be traffic incidents.
_TRAFFIC_KEYWORDS = frozenset([
    # English
    "traffic", "road", "accident", "vehicle", "car", "truck", "bus", "bike", "auto",
    "signal", "junction", "jam", "block", "congestion", "diversion", "closure",
    "breakdown", "stalled", "crash", "collision", "pothole", "barricade", "police",
    "highway", "flyover", "underpass", "construction", "flood", "waterlog", "tree",
    "fallen", "lane", "parking", "tow", "ambulance", "fire", "lorry", "tanker",
    "convoy", "vip", "rally", "protest", "procession", "event", "concert",
    # Kannada transliterated
    "raste", "rasthe", "mara", "apagata", "vahana", "jama",
])

EVENT_CAUSE_KEYWORDS: dict[str, list[str]] = {
    "vehicle_breakdown": ["breakdown", "stalled", "engine failure", "broken down",
                          "puncture", "flat tyre", "flat tire", "battery dead"],
    "tree_fall":         ["tree", "fallen tree", "tree down", "tree fall", "tree branch"],
    "accident":          [
        "accident", "collision", "crash", "hit and run", "knocked",
        "toppled", "overturned", "rollover", "skid", "rammed",
        "dies", "died", "dead", "death", "fatality", "killed", "killing",
        "injured", "serious injury", "critical condition",
        "fire", "explosion", "ambulance", "emergency",
        "outbreak", "stampede",
    ],
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

_lock           = threading.Lock()
_dur_model: Any = None
_pri_model: Any = None
_le: dict       = {}

_HF_MODEL   = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
_HF_API_URL = f"https://router.huggingface.co/hf-inference/pipeline/feature-extraction/{_HF_MODEL}"

_hf_log = logging.getLogger("drishti.hf_embed")


def _hf_status() -> dict:
    """Return a dict describing HuggingFace readiness — used by /health."""
    import os
    key = os.getenv("HF_API_KEY", "")
    return {
        "key_set":  bool(key),
        "model":    _HF_MODEL,
        "emb_dim":  EMB_DIM,
        "api_url":  _HF_API_URL,
        "status":   "active" if key else "degraded — zero embeddings",
    }


def _hf_embed(text: str) -> list[float] | None:
    """Call HuggingFace Inference API for a 384-dim sentence embedding via InferenceClient."""
    import os
    key = os.getenv("HF_API_KEY", "")
    if not key:
        _hf_log.warning("HF_API_KEY not set — embeddings disabled, using zero-padding.")
        return None

    _hf_log.info("HuggingFace embed request: model=%s text_len=%d chars", _HF_MODEL, len(text))
    try:
        from huggingface_hub import InferenceClient
        client = InferenceClient(model=_HF_MODEL, token=key)
        result = client.feature_extraction(text, normalize=True)

        vec = result.tolist() if hasattr(result, "tolist") else list(result)
        # feature_extraction may return [[...]] or [...]
        if vec and isinstance(vec[0], list):
            vec = vec[0]

        if len(vec) != EMB_DIM:
            _hf_log.error(
                "HuggingFace unexpected dims: expected %d got %d — zero-padding.", EMB_DIM, len(vec)
            )
            return None

        _hf_log.info("HuggingFace embed OK: dims=%d", len(vec))
        return vec

    except Exception as exc:
        _hf_log.error("HuggingFace embed failed: %s — zero-padding.", exc)
        return None


def _load_models() -> None:
    global _dur_model, _pri_model, _le
    if _dur_model is not None:
        return
    import os
    import joblib

    _dur_model = joblib.load(MODELS_DIR / "duration_model.pkl")
    _pri_model = joblib.load(MODELS_DIR / "resource_model.pkl")
    _le        = joblib.load(MODELS_DIR / "label_encoders.pkl")

    hf_key_set = bool(os.getenv("HF_API_KEY", ""))
    _hf_log.info(
        "XGBoost models loaded — HF_API_KEY %s — embeddings will be %s",
        "IS SET" if hf_key_set else "NOT SET",
        "active (semantic text signal ON)" if hf_key_set
        else "ZERO-PADDED (text signal OFF — predictions rely on structural features only)",
    )


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


_SEVERE_CAUSES = frozenset({"accident", "vip_movement"})

def _get_urgency(priority_pred: int, duration_min: float, road_closure: bool, event_cause: str = "others") -> str:
    severe = event_cause in _SEVERE_CAUSES
    if priority_pred == 1 or severe:                       return "CRITICAL"
    if road_closure and duration_min > 60:                 return "HIGH"
    if duration_min > 120:                                 return "MEDIUM"
    return "LOW"


# ─── Translation (Kannada / Hindi → English via Gemini) ──────────────────────

def translate_to_english(text: str) -> str:
    """Translate text to English using Gemini if it contains non-ASCII characters.
    Returns the original text unchanged if it is already ASCII (English).
    Falls back to original on any error so the pipeline never breaks.
    """
    if not any(ord(c) > 127 for c in text):
        return text  # already English / ASCII

    load_env_file()
    key = get_gemini_api_key()
    if not key:
        return text

    try:
        import concurrent.futures
        from google import genai

        client = genai.Client(api_key=key)

        def _translate() -> str:
            response = client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=(
                    "Translate the following text to English. "
                    "Return ONLY the translated English text, nothing else. "
                    "Preserve place names and road names as-is.\n\n"
                    f"Text: {text[:600]}"
                ),
            )
            return (response.text or "").strip()

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            translated = ex.submit(_translate).result(timeout=_GEMINI_TIMEOUT_S)

        return translated if translated else text
    except Exception:
        return text


# ─── LLM Firewall (keyword → Gemini, no local model) ─────────────────────────

def _keyword_prefilter(description: str) -> bool:
    # If description contains non-ASCII characters (Kannada, Hindi, etc.)
    # skip keyword check and let Gemini decide — it handles Indian scripts natively
    if any(ord(c) > 127 for c in description):
        return True
    lowered = description.lower()
    return any(kw in lowered for kw in _TRAFFIC_KEYWORDS)


def llm_firewall(description: str) -> tuple[bool, str]:
    """Validates that the description is about a road traffic incident.

    Gate 1: keyword pre-filter — zero latency, no network
    Gate 2: Gemini YES/NO      — ~1-2s, no local model loaded
    """
    # ── Gate 1: keyword pre-filter ────────────────────────────────────────────
    if not _keyword_prefilter(description):
        return False, "Input does not describe a road traffic incident."

    # ── Gate 2: Gemini validation ─────────────────────────────────────────────
    load_env_file()
    key = get_gemini_api_key()
    if not key:
        # No Gemini key configured — trust keyword filter
        return True, "Keyword match (Gemini key not configured)"

    try:
        import concurrent.futures
        from google import genai

        client = genai.Client(api_key=key)

        def _call_gemini() -> str:
            response = client.models.generate_content(
                model    = "gemini-2.5-flash-lite",
                contents = (
                    "You are a spam filter for a Bengaluru traffic reporting app. "
                    "Citizens report issues like traffic jams, accidents, potholes, signal failures, "
                    "road blocks, vehicle breakdowns, flooding, illegal parking, or anything affecting "
                    "roads and public movement. "
                    "Descriptions may be in Kannada (ಕನ್ನಡ), Hindi, English, or a mix — treat all equally. "
                    "Reply ONLY with YES if this could plausibly be a road/traffic/vehicle/public-safety "
                    "related complaint (even if vague, brief, or in a local language). "
                    "Reply NO only if it is clearly unrelated spam (e.g. food delivery, shopping, personal disputes).\n\n"
                    f"Description: {description[:500]}"
                ),
            )
            return (response.text or "").strip().upper()

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(_call_gemini)
            answer = future.result(timeout=_GEMINI_TIMEOUT_S)

        if answer.startswith("NO"):
            return False, "Gemini determined the description is not a traffic incident."
        # YES or any other response — pass through (default to accept)
        return True, "Gemini validated"
    except concurrent.futures.TimeoutError:
        # Gemini slow or unavailable — don't penalise the citizen
        return True, "Validation timed out — passed by keyword match"
    except Exception:
        # API error — pass through rather than wrongly reject
        return True, "Validation unavailable — passed by keyword match"


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
    """Pure ML inference — no firewall. Embedding features are zero-padded
    (SentenceTransformer removed to fit 512MB RAM); structural features drive predictions."""
    _ensure_loaded()

    import datetime
    now = datetime.datetime.now()
    if hour        is None: hour        = now.hour
    if day_of_week is None: day_of_week = now.weekday()
    if month       is None: month       = now.month

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
        "is_night"             : 1 if (hour >= 20 or hour <= 6) else 0,
        "is_peak_am"           : 1 if 4 <= hour <= 7 else 0,
        "is_peak_pm"           : 1 if 19 <= hour <= 22 else 0,
        "reporting_delay_min"  : 0,
        "latitude"             : latitude,
        "longitude"            : longitude,
        "requires_road_closure": int(requires_road_closure),
        "corridor_risk"        : _get_corridor_risk(corridor),
        "event_cause_enc"      : _safe_encode(_le["event_cause"],    event_cause),
        "veh_type_enc"         : _safe_encode(_le["veh_type"],       veh_type),
        "corridor_enc"         : _safe_encode(_le["corridor"],        corridor),
        "police_station_enc"   : _safe_encode(_le["police_station"], police_station),
        "zone_enc"             : _safe_encode(_le["zone"],            zone),
    }
    raw_emb = _hf_embed(description)
    if raw_emb and len(raw_emb) == EMB_DIM:
        emb_row = {f"emb_{i}": float(raw_emb[i]) for i in range(EMB_DIM)}
        _hf_log.debug("Prediction using REAL HuggingFace embeddings — text signal active")
    else:
        emb_row = {f"emb_{i}": 0.0 for i in range(EMB_DIM)}
        _hf_log.warning(
            "Prediction using ZERO embeddings — XGBoost text features are all 0.0. "
            "Set HF_API_KEY env var to enable semantic signal. "
            "Structural features (cause, corridor, zone, time) still drive the prediction."
        )
    X = pd.DataFrame([{**struct_row, **emb_row}])[ALL_FEATURES]

    duration_min  = float(_dur_model.predict(X)[0])
    priority_pred = int(_pri_model.predict(X)[0])
    personnel     = _get_personnel(priority_pred, duration_min, requires_road_closure)
    urgency       = _get_urgency(priority_pred, duration_min, requires_road_closure, event_cause)

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
    is_valid, fw_reason = llm_firewall(description)

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
