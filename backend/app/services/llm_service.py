"""
Ollama local LLM integration for generating dispatch recommendations.

Falls back to the rule-based text from grievance_agent if Ollama is not
running or takes longer than the timeout.
"""

import logging
import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout

import requests

logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
_LLM_TIMEOUT_S = float(os.getenv("OLLAMA_TIMEOUT_S", "6"))

_RANK_MAP = {
    "event_congestion":     ("1 Inspector, 2 Sub-Inspectors, 8 Constables", "45–90 min"),
    "illegal_parking":      ("1 Sub-Inspector, 4 Constables", "15–30 min"),
    "road_closure":         ("1 Inspector, 2 Sub-Inspectors, 6 Constables, 1 Tow Unit", "60–120 min"),
    "accident_or_breakdown":("1 Inspector, 2 Sub-Inspectors, 6 Constables, 1 Ambulance", "30–60 min"),
    "signal_failure":       ("1 Sub-Inspector, 4 Constables + BBMP signal team", "60–180 min"),
    "other":                ("1 Sub-Inspector, 4 Constables", "30–60 min"),
}


def _call_ollama(prompt: str) -> str:
    resp = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
        timeout=_LLM_TIMEOUT_S,
    )
    resp.raise_for_status()
    text = resp.json().get("response", "").strip()
    return text if len(text) > 20 else ""


def generate_dispatch_recommendation(
    complaint_type: str,
    severity: str,
    location_text: str,
    description: str,
    score: int,
    zone: str | None = None,
    corridor: str | None = None,
    fallback_text: str = "",
) -> str:
    ranks, duration = _RANK_MAP.get(complaint_type, _RANK_MAP["other"])
    location_full = location_text
    if corridor:
        location_full += f" ({corridor} corridor)"
    if zone:
        location_full += f", {zone}"

    prompt = (
        f"You are DRISHTI-AI, the dispatch intelligence assistant for Bengaluru Traffic Police "
        f"Control Centre. Respond with exactly 2 sentences — no bullet points, no headers.\n\n"
        f"Complaint: {complaint_type.replace('_', ' ').title()}\n"
        f"Severity: {severity}\n"
        f"Location: {location_full}\n"
        f"Description: {description}\n"
        f"AI Priority Score: {score}/100\n"
        f"Suggested strength: {ranks}\n"
        f"Estimated duration: {duration}\n\n"
        f"Sentence 1: Immediate dispatch action — include officer ranks and exact count.\n"
        f"Sentence 2: Estimated resolution timeline and any special coordination required.\n"
        f"Use Bengaluru Traffic Police dispatch language. Be direct and operational."
    )

    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_call_ollama, prompt)
        try:
            result = future.result(timeout=_LLM_TIMEOUT_S + 1)
            if result:
                logger.info("LLM recommendation generated via Ollama (%s chars)", len(result))
                return result
        except (FuturesTimeout, Exception) as exc:
            logger.debug("Ollama unavailable, using rule-based fallback: %s", exc)

    return fallback_text
