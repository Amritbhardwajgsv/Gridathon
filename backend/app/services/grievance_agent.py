"""
ML-driven triage for citizen grievances.

Uses the trained RandomForest models at the repo root:
  traffic_impact_random_forest_classifier.pkl  → severity label
  traffic_duration_random_forest_model.pkl      → predicted duration → score
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from app.schemas import CitizenGrievanceCreateRequest

# ── Model loading ─────────────────────────────────────────────────────────────
_REPO_ROOT = Path(__file__).resolve().parents[3]   # backend/app/services/ → repo root
_CLF_PATH  = _REPO_ROOT / "traffic_impact_random_forest_classifier.pkl"
_REG_PATH  = _REPO_ROOT / "traffic_duration_random_forest_model.pkl"

try:
    import joblib
    _clf = joblib.load(_CLF_PATH)
    _reg = joblib.load(_REG_PATH)
    _MODELS_LOADED = True
except Exception:
    _clf = _reg = None
    _MODELS_LOADED = False

# ── Feature mapping tables ────────────────────────────────────────────────────
_BLR_LAT = 12.9716
_BLR_LNG  = 77.5946

# complaint_type → model event_cause_grouped
_CAUSE: dict[str, str] = {
    "accident_or_breakdown": "accident",
    "road_closure":          "road_conditions",
    "signal_failure":        "others",
    "event_congestion":      "public_event",
    "illegal_parking":       "others",
    "other":                 "others",
}

# complaint_type → model priority feature ("High"|"Low")
_PRIORITY: dict[str, str] = {
    "accident_or_breakdown": "High",
    "road_closure":          "High",
    "event_congestion":      "Low",
    "signal_failure":        "Low",
    "illegal_parking":       "Low",
    "other":                 "Low",
}

# User-facing zone names → model zone category
_ZONE: dict[str, str] = {
    "central zone":           "Central Zone 1",
    "east zone":              "East Zone 1",
    "west zone":              "West Zone 1",
    "north zone":             "North Zone 1",
    "south zone":             "South Zone 1",
    "south-east zone":        "East Zone 2",
    "north-east zone":        "North Zone 2",
    "whitefield zone":        "East Zone 2",
    "electronic city zone":   "South Zone 2",
    # pass-through for already-valid values
    "central zone 1":         "Central Zone 1",
    "central zone 2":         "Central Zone 2",
    "east zone 1":            "East Zone 1",
    "east zone 2":            "East Zone 2",
    "north zone 1":           "North Zone 1",
    "north zone 2":           "North Zone 2",
    "south zone 1":           "South Zone 1",
    "south zone 2":           "South Zone 2",
    "west zone 1":            "West Zone 1",
    "west zone 2":            "West Zone 2",
}

# User-facing corridor names → model corridor category
_CORRIDOR: dict[str, str] = {
    "outer ring road":           "ORR East 1",
    "mg road":                   "CBD 1",
    "hosur road":                "Hosur Road",
    "old madras road":           "Old Madras Road",
    "tumakuru road":             "Tumkur Road",
    "mysore road":               "Mysore Road",
    "airport road":              "Airport New South Road",
    "bannerghatta road":         "Bannerghata Road",
    "kanakapura road":           "Non-corridor",
    "bellary road":              "Bellary Road 1",
    "sarjapur road":             "Varthur Road",
    "hal airport road":          "Old Airport Road",
    "kr puram approach":         "IRR(Thanisandra road)",
    "silk board approach":       "ORR East 2",
    "hebbal flyover approach":   "ORR North 1",
    # pass-through for already-valid model values
    "orr east 1":                "ORR East 1",
    "orr east 2":                "ORR East 2",
    "orr north 1":               "ORR North 1",
    "orr north 2":               "ORR North 2",
    "orr west 1":                "ORR West 1",
    "cbd 1":                     "CBD 1",
    "cbd 2":                     "CBD 2",
    "bellary road 1":            "Bellary Road 1",
    "bellary road 2":            "Bellary Road 2",
    "hennur main road":          "Hennur Main Road",
    "magadi road":               "Magadi Road",
    "irr(thanisandra road)":     "IRR(Thanisandra road)",
    "west of chord road":        "West of Chord Road",
    "varthur road":              "Varthur Road",
    "tumkur road":               "Tumkur Road",
    "old airport road":          "Old Airport Road",
    "bannerghata road":          "Bannerghata Road",
    "non-corridor":              "Non-corridor",
    "airport new south road":    "Airport New South Road",
}

_ROAD_CLOSURE_WORDS = frozenset({
    "closed", "blocked", "barricade", "diversion", "diverted",
    "road block", "no entry", "shut", "sealed",
})


def _map_zone(zone: str | None) -> str:
    if not zone:
        return "Unknown"
    return _ZONE.get(zone.strip().lower(), "Unknown")


def _map_corridor(corridor: str | None) -> str:
    if not corridor:
        return "Non-corridor"
    return _CORRIDOR.get(corridor.strip().lower(), "Non-corridor")


def _has_road_closure(complaint_type: str, description: str | None) -> bool:
    if complaint_type == "road_closure":
        return True
    if not description:
        return False
    return any(kw in description.lower() for kw in _ROAD_CLOSURE_WORDS)


def _duration_boost(minutes: float) -> int:
    """0–8 extra score points proportional to predicted blockage duration."""
    return min(8, int(minutes / 2))


# ── Severity → base priority score ───────────────────────────────────────────
_SEV_SCORE: dict[str, int] = {
    "Critical": 92,
    "High":     72,
    "Medium":   48,
    "Low":      22,
}

# ── Fallback rule-based inference (when models not available) ─────────────────
_TYPE_DEFAULT: dict[str, str] = {
    "accident_or_breakdown": "High",
    "road_closure":          "High",
    "signal_failure":        "Medium",
    "event_congestion":      "Medium",
    "illegal_parking":       "Low",
    "other":                 "Low",
}
_CRITICAL_KW = frozenset({"ambulance", "fire engine", "emergency", "critical", "death", "fatality", "stampede", "explosion", "collapse"})
_HIGH_KW     = frozenset({"blocked", "stuck", "major", "large crowd", "barricaded", "diverted", "road closed", "ambulance blocked"})
_LOW_KW      = frozenset({"slow", "minor", "slight", "small", "light traffic"})


def _rule_severity(complaint_type: str, description: str | None) -> str:
    base = _TYPE_DEFAULT.get(complaint_type, "Medium")
    if not description:
        return base
    desc = description.lower()
    if any(kw in desc for kw in _CRITICAL_KW):
        return "Critical"
    if any(kw in desc for kw in _HIGH_KW) and base in ("Low", "Medium"):
        return "High"
    if any(kw in desc for kw in _LOW_KW) and base == "High":
        return "Medium"
    return base


# ── Recommendation text ───────────────────────────────────────────────────────
_RULE_TEXTS = {
    (90, 101): (
        "Dispatch Inspector-level officer with minimum 8 personnel immediately; "
        "coordinate with PCR and activate corridor watch. Estimated resolution: 60–120 min."
    ),
    (75, 90): (
        "Deploy Sub-Inspector with 4–6 Constables; verify location and link to active "
        "event in system. Estimated resolution: 30–60 min."
    ),
    (50, 75): (
        "Queue for operator triage; cross-check against current corridor predictions before "
        "dispatch. Estimated resolution: 20–45 min."
    ),
    (0, 50): (
        "Log as low-priority signal for heatmap analysis and weekly model feedback. "
        "Monitor for escalation; no immediate dispatch required."
    ),
}


def _rule_text(score: int) -> str:
    for (lo, hi), text in _RULE_TEXTS.items():
        if lo <= score < hi:
            return text
    return _RULE_TEXTS[(0, 50)]


# ── Main entry point ──────────────────────────────────────────────────────────

def triage_grievance(payload: CitizenGrievanceCreateRequest) -> tuple[int, str, str]:
    """
    Returns (priority_score 0-100, recommendation_text, severity label).
    Severity is always ML-computed (classifier model when available, rules otherwise).
    Duration from the regressor is used to fine-tune the priority score.
    """
    now = datetime.now(timezone.utc)

    if _MODELS_LOADED:
        row = pd.DataFrame([{
            "event_cause_grouped":   _CAUSE.get(payload.complaint_type, "others"),
            "event_type":            "unplanned",   # all citizen reports are unplanned
            "priority":              _PRIORITY.get(payload.complaint_type, "Low"),
            "requires_road_closure": _has_road_closure(payload.complaint_type, payload.description),
            "corridor":              _map_corridor(payload.corridor),
            "zone":                  _map_zone(payload.zone),
            "latitude":              payload.latitude  if payload.latitude  is not None else _BLR_LAT,
            "longitude":             payload.longitude if payload.longitude is not None else _BLR_LNG,
            "hour":                  now.hour,
            "day_of_week":           now.weekday(),
            "month":                 now.month,
        }])

        severity         = str(_clf.predict(row)[0])          # Critical | High | Medium | Low
        duration_minutes = float(_reg.predict(row)[0])

        score = min(100, _SEV_SCORE[severity] + _duration_boost(duration_minutes))
    else:
        severity = _rule_severity(payload.complaint_type, payload.description)
        score    = _SEV_SCORE.get(severity, 22)
        if payload.latitude is not None:
            score = min(100, score + 3)

    fallback = _rule_text(score)

    try:
        from app.services.llm_service import generate_dispatch_recommendation  # type: ignore[import]
        recommendation = generate_dispatch_recommendation(
            complaint_type=payload.complaint_type,
            severity=severity,
            location_text=payload.location_text,
            description=payload.description,
            score=score,
            zone=payload.zone,
            corridor=payload.corridor,
            fallback_text=fallback,
        )
    except Exception:
        recommendation = fallback

    return score, recommendation, severity
