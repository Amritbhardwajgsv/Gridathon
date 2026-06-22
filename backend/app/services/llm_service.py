"""
Gemini-powered dispatch recommendation generator for DRISHTI.
Falls back to rule-based text if the API key is missing or the call fails.
"""
from __future__ import annotations

import logging

from app.core.config import get_gemini_api_key

logger = logging.getLogger(__name__)

_RANK_MAP = {
    "event_congestion":      ("1 Inspector, 2 Sub-Inspectors, 8 Constables",          "45–90 min"),
    "illegal_parking":       ("1 Sub-Inspector, 4 Constables",                         "15–30 min"),
    "road_closure":          ("1 Inspector, 2 Sub-Inspectors, 6 Constables, 1 Tow",    "60–120 min"),
    "accident_or_breakdown": ("1 Inspector, 2 Sub-Inspectors, 6 Constables, Ambulance","30–60 min"),
    "signal_failure":        ("1 SI, 4 Constables + BBMP signal team",                 "60–180 min"),
    "other":                 ("1 Sub-Inspector, 4 Constables",                         "30–60 min"),
}


def _call_gemini(prompt: str) -> str:
    from google import genai
    key = get_gemini_api_key()
    if not key:
        return ""
    client = genai.Client(api_key=key)
    response = client.models.generate_content(
        model="gemini-2.5-flash-lite",
        contents=prompt,
    )
    text = (response.text or "").strip()
    return text if len(text) > 20 else ""


def generate_dispatch_recommendation(
    complaint_type: str,
    severity: str,
    location_text: str,
    description: str | None,
    score: int,
    zone: str | None           = None,
    corridor: str | None       = None,
    fallback_text: str         = "",
    duration_min: float | None = None,
    personnel: int | None      = None,
) -> str:
    ranks, est_duration = _RANK_MAP.get(complaint_type, _RANK_MAP["other"])

    location_full = location_text
    if corridor: location_full += f" ({corridor} corridor)"
    if zone:     location_full += f", {zone}"

    ml_line = ""
    if duration_min is not None:
        ml_line = (
            f"ML Prediction: {round(duration_min)} min estimated resolution, "
            f"{personnel or '?'} officers needed.\n"
        )

    prompt = (
        "You are DRISHTI-AI, Bengaluru Traffic Police dispatch intelligence. "
        "Reply with exactly 2 sentences — no bullets, no headers.\n\n"
        f"Complaint: {complaint_type.replace('_', ' ').title()}\n"
        f"Severity: {severity}\n"
        f"Location: {location_full}\n"
        f"Description: {description or 'N/A'}\n"
        f"AI Priority Score: {score}/100\n"
        f"{ml_line}"
        f"Suggested strength: {ranks}\n"
        f"Estimated duration: {est_duration}\n\n"
        "Sentence 1: Immediate dispatch action — officer ranks and exact count.\n"
        "Sentence 2: Resolution timeline and any special coordination needed.\n"
        "Use Bengaluru Traffic Police operational language. Be direct."
    )

    try:
        result = _call_gemini(prompt)
        if result:
            logger.info("Gemini recommendation generated (%d chars)", len(result))
            return result
    except Exception as exc:
        logger.debug("Gemini unavailable, using fallback: %s", exc)

    return fallback_text
