"""
Incident deployment predictor.
  - llm_firewall()      : validates description via keyword filter + Gemini (no local model)
  - run_ml_only()       : XGBoost inference only (no firewall) — used by grievance_agent
  - predict_incident()  : full pipeline (firewall → ML) — used by /predict/incident endpoint

SentenceTransformer has been removed to fit within Render free-tier 512MB RAM.
Embedding features are zero-padded for XGBoost; structural features carry the prediction.
"""
from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

import pandas as pd

from app.core.config import get_gemini_api_key, load_env_file

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"

STRUCT_FEATURES = [
    "hour", "day_of_week", "month", "is_night", "reporting_delay_min",
    "latitude", "longitude", "requires_road_closure",
    "event_cause_enc", "veh_type_enc", "corridor_enc",
    "police_station_enc", "zone_enc",
]
EMB_DIM              = 384
TRANSFORMER_FEATURES = [f"emb_{i}" for i in range(EMB_DIM)]
ALL_FEATURES         = STRUCT_FEATURES + TRANSFORMER_FEATURES

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

_lock           = threading.Lock()
_dur_model: Any = None
_pri_model: Any = None
_le: dict       = {}

_HF_MODEL   = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
_HF_API_URL = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{_HF_MODEL}"


def _hf_embed(text: str) -> list[float] | None:
    """Call HuggingFace Inference API to get 384-dim embedding. Returns None on failure."""
    import logging, os, requests
    log = logging.getLogger("drishti.hf")
    key = os.getenv("HF_API_KEY", "")
    if not key:
        log.warning("HF_API_KEY not set — using zero embeddings")
        return None
    try:
        resp = requests.post(
            _HF_API_URL,
            headers={"Authorization": f"Bearer {key}"},
            json={"inputs": text, "options": {"wait_for_model": True}},
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            # API returns list-of-lists for batched input; unwrap if needed
            vec = data[0] if isinstance(data[0], list) else data
            log.info("HuggingFace embedding OK — %d dims", len(vec))
            return vec
        log.warning("HuggingFace API returned %s: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        log.warning("HuggingFace API error: %s", exc)
    return None


def _load_models() -> None:
    global _dur_model, _pri_model, _le
    if _dur_model is not None:
        return
    import joblib
    _dur_model = joblib.load(MODELS_DIR / "duration_model.pkl")
    _pri_model = joblib.load(MODELS_DIR / "resource_model.pkl")
    _le        = joblib.load(MODELS_DIR / "label_encoders.pkl")


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


# ─── LLM Firewall (keyword → Gemini, no local model) ─────────────────────────

def _keyword_prefilter(description: str) -> bool:
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
                model    = "gemini-2.0-flash-lite",
                contents = (
                    "Is the following description about a road traffic incident "
                    "(breakdown, accident, congestion, tree fall, signal failure, flooding, etc.)? "
                    "Reply with exactly one word: YES or NO.\n\n"
                    f"Description: {description[:500]}"
                ),
            )
            return (response.text or "").strip().upper()

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(_call_gemini)
            answer = future.result(timeout=_GEMINI_TIMEOUT_S)

        if answer.startswith("YES"):
            return True, "Gemini validated"
        if answer.startswith("NO"):
            return False, "Gemini determined the description is not a traffic incident."
        # Ambiguous response — pass through
        return True, "Gemini response unclear — passed by keyword match"
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
    raw_emb = _hf_embed(description)
    if raw_emb and len(raw_emb) == EMB_DIM:
        emb_row = {f"emb_{i}": float(raw_emb[i]) for i in range(EMB_DIM)}
    else:
        emb_row = {f"emb_{i}": 0.0 for i in range(EMB_DIM)}
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
