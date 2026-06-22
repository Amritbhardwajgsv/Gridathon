"""
ML triage for citizen grievances.

Pipeline:
  1. Try XGBoost (incident_predictor.run_ml_only) — full NLP + structured features
  2. Fall back to legacy RandomForest models if XGBoost not loaded
  3. Fall back to rule-based severity if no models available
  4. Generate dispatch recommendation via Gemini (llm_service)
  5. Return (priority_score, recommendation_json, severity)
     where recommendation_json is a JSON string consumed by the admin dashboard.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import pandas as pd

from app.schemas import CitizenGrievanceCreateRequest

logger = logging.getLogger(__name__)

# ─── Legacy RF models (kept as fallback) ─────────────────────────────────────

from pathlib import Path

_MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
_BLR_LAT    = 12.9716
_BLR_LNG    = 77.5946

try:
    import joblib
    _clf = joblib.load(_MODELS_DIR / "impact_model.pkl")
    _reg = joblib.load(_MODELS_DIR / "traffic_duration_random_forest_model.pkl")
    _RF_LOADED = True
except Exception:
    _clf = _reg = None
    _RF_LOADED = False

# ─── Feature mapping for legacy RF models ─────────────────────────────────────

_CAUSE: dict[str, str] = {
    "accident_or_breakdown": "accident",
    "road_closure":          "road_conditions",
    "signal_failure":        "others",
    "event_congestion":      "public_event",
    "illegal_parking":       "others",
    "other":                 "others",
}
_PRIORITY: dict[str, str] = {
    "accident_or_breakdown": "High",
    "road_closure":          "High",
    "event_congestion":      "Low",
    "signal_failure":        "Low",
    "illegal_parking":       "Low",
    "other":                 "Low",
}
_ZONE: dict[str, str] = {
    "central zone": "Central Zone 1", "east zone": "East Zone 1",
    "west zone": "West Zone 1",       "north zone": "North Zone 1",
    "south zone": "South Zone 1",     "south-east zone": "East Zone 2",
    "north-east zone": "North Zone 2","whitefield zone": "East Zone 2",
    "electronic city zone": "South Zone 2",
    **{f"central zone {i}": f"Central Zone {i}" for i in (1, 2)},
    **{f"east zone {i}":    f"East Zone {i}"    for i in (1, 2)},
    **{f"north zone {i}":   f"North Zone {i}"   for i in (1, 2)},
    **{f"south zone {i}":   f"South Zone {i}"   for i in (1, 2)},
    **{f"west zone {i}":    f"West Zone {i}"    for i in (1, 2)},
}
_CORRIDOR: dict[str, str] = {
    "outer ring road": "ORR East 1",   "mg road": "CBD 1",
    "hosur road": "Hosur Road",         "tumakuru road": "Tumkur Road",
    "mysore road": "Mysore Road",       "airport road": "Airport New South Road",
    "bannerghatta road": "Bannerghata Road", "bellary road": "Bellary Road 1",
    "sarjapur road": "Varthur Road",    "hal airport road": "Old Airport Road",
    "silk board approach": "ORR East 2","hebbal flyover approach": "ORR North 1",
    "non-corridor": "Non-corridor",
}
_ROAD_CLOSURE_WORDS = frozenset({
    "closed", "blocked", "barricade", "diversion", "diverted",
    "road block", "no entry", "shut", "sealed",
})
_RUSH_HOURS = frozenset({7, 8, 9, 17, 18, 19, 20})

def _map_zone(z: str | None) -> str:
    return _ZONE.get((z or "").strip().lower(), "Unknown")

def _map_corridor(c: str | None) -> str:
    return _CORRIDOR.get((c or "").strip().lower(), "Non-corridor")

def _has_road_closure(complaint_type: str, description: str | None) -> bool:
    if complaint_type == "road_closure":
        return True
    if not description:
        return False
    return any(kw in description.lower() for kw in _ROAD_CLOSURE_WORDS)

# ─── Severity / score tables ──────────────────────────────────────────────────

_SEV_SCORE: dict[str, int] = {
    "Critical": 92, "High": 72, "Medium": 48, "Low": 22,
}
_TYPE_DEFAULT: dict[str, str] = {
    "accident_or_breakdown": "High", "road_closure": "High",
    "signal_failure": "Medium",      "event_congestion": "Medium",
    "illegal_parking": "Low",        "other": "Low",
}
_CRITICAL_KW = frozenset({"ambulance", "fire engine", "emergency", "critical", "death", "fatality", "stampede"})
_HIGH_KW     = frozenset({"blocked", "stuck", "major", "barricaded", "diverted", "road closed"})
_LOW_KW      = frozenset({"slow", "minor", "slight", "small", "light traffic"})

def _rule_severity(complaint_type: str, description: str | None) -> str:
    base = _TYPE_DEFAULT.get(complaint_type, "Medium")
    if not description:
        return base
    desc = description.lower()
    if any(kw in desc for kw in _CRITICAL_KW): return "Critical"
    if any(kw in desc for kw in _HIGH_KW) and base in ("Low", "Medium"): return "High"
    if any(kw in desc for kw in _LOW_KW) and base == "High": return "Medium"
    return base

_RULE_TEXTS = {
    (90, 101): "Dispatch Inspector with 8 personnel immediately; activate corridor watch. ETA: 60–120 min.",
    (75, 90):  "Deploy Sub-Inspector with 4–6 Constables; verify location and link incident. ETA: 30–60 min.",
    (50, 75):  "Queue for operator triage; cross-check corridor before dispatch. ETA: 20–45 min.",
    (0,  50):  "Log as low-priority for heatmap analysis; monitor for escalation.",
}
def _rule_text(score: int) -> str:
    for (lo, hi), text in _RULE_TEXTS.items():
        if lo <= score < hi:
            return text
    return _RULE_TEXTS[(0, 50)]

# ─── Main entry point ─────────────────────────────────────────────────────────

def triage_grievance(payload: CitizenGrievanceCreateRequest) -> tuple[int, str, str]:
    """
    Returns (priority_score 0-100, recommendation_json str, severity label).
    recommendation_json is a JSON string with keys:
      text, duration_min, personnel, urgency, detected_cause, detected_veh_type
    """
    now = datetime.now(timezone.utc)
    road_closure = _has_road_closure(payload.complaint_type, payload.description)

    ml_pred: dict | None = None

    # ── Try XGBoost (new models) ──────────────────────────────────────────────
    try:
        from app.services.incident_predictor import run_ml_only, _ensure_loaded
        _ensure_loaded()
        ml_pred = run_ml_only(
            description           = payload.description or payload.complaint_type,
            latitude              = payload.latitude  if payload.latitude  is not None else _BLR_LAT,
            longitude             = payload.longitude if payload.longitude is not None else _BLR_LNG,
            requires_road_closure = road_closure,
            corridor              = _map_corridor(payload.corridor),
            zone                  = _map_zone(payload.zone),
        )
    except Exception as exc:
        logger.debug("XGBoost prediction failed, falling back to RF: %s", exc)

    # ── Derive severity ───────────────────────────────────────────────────────
    if ml_pred:
        urgency = ml_pred.get("urgency", "LOW")
        severity = {"CRITICAL": "Critical", "HIGH": "High", "MEDIUM": "Medium", "LOW": "Low"}.get(urgency, "Medium")
        duration_min = ml_pred["estimated_duration_min"]
        score = min(100, _SEV_SCORE[severity] + min(8, int(duration_min / 30)))
    elif _RF_LOADED:
        row = pd.DataFrame([{
            "event_cause_grouped":   _CAUSE.get(payload.complaint_type, "others"),
            "event_type":            "unplanned",
            "priority":              _PRIORITY.get(payload.complaint_type, "Low"),
            "requires_road_closure": road_closure,
            "corridor":              _map_corridor(payload.corridor),
            "zone":                  _map_zone(payload.zone),
            "latitude":              payload.latitude  if payload.latitude  is not None else _BLR_LAT,
            "longitude":             payload.longitude if payload.longitude is not None else _BLR_LNG,
            "hour":                  now.hour,
            "day_of_week":           now.weekday(),
            "month":                 now.month,
            "is_weekend":            int(now.weekday() >= 5),
            "rush_hour":             int(now.hour in _RUSH_HOURS),
        }])
        severity     = str(_clf.predict(row)[0])
        duration_min = float(_reg.predict(row)[0])
        score        = min(100, _SEV_SCORE.get(severity, 22) + min(8, int(duration_min / 2)))
        ml_pred = {
            "estimated_duration_min": round(duration_min, 1),
            "estimated_duration_hrs": round(duration_min / 60, 2),
            "priority": "High" if severity in ("Critical", "High") else "Low",
            "personnel_to_deploy": 3,
            "urgency": "HIGH" if severity in ("Critical", "High") else "MEDIUM",
            "detected_cause": _CAUSE.get(payload.complaint_type, "others"),
            "detected_veh_type": "unknown",
        }
    else:
        severity     = _rule_severity(payload.complaint_type, payload.description)
        score        = _SEV_SCORE.get(severity, 22)
        ml_pred      = None

    # ── Generate Gemini recommendation text ───────────────────────────────────
    fallback = _rule_text(score)
    try:
        from app.services.llm_service import generate_dispatch_recommendation
        rec_text = generate_dispatch_recommendation(
            complaint_type = payload.complaint_type,
            severity       = severity,
            location_text  = payload.location_text or "Unknown location",
            description    = payload.description,
            score          = score,
            zone           = payload.zone,
            corridor       = payload.corridor,
            fallback_text  = fallback,
            duration_min   = ml_pred["estimated_duration_min"] if ml_pred else None,
            personnel      = ml_pred["personnel_to_deploy"]    if ml_pred else None,
        )
    except Exception:
        rec_text = fallback

    # ── Build JSON recommendation ─────────────────────────────────────────────
    recommendation = json.dumps({
        "text"              : rec_text,
        "duration_min"      : ml_pred["estimated_duration_min"] if ml_pred else None,
        "duration_hrs"      : ml_pred["estimated_duration_hrs"] if ml_pred else None,
        "personnel"         : ml_pred["personnel_to_deploy"]    if ml_pred else None,
        "urgency"           : ml_pred["urgency"]                if ml_pred else None,
        "detected_cause"    : ml_pred["detected_cause"]         if ml_pred else None,
        "detected_veh_type" : ml_pred["detected_veh_type"]      if ml_pred else None,
    }, ensure_ascii=False)

    return score, recommendation, severity
