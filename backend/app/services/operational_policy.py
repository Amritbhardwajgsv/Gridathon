import hashlib
import json
from typing import Any

from app.schemas import ImpactPredictionRequest


MODEL_FEATURE_KEYS = {
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
    "is_weekend",
    "rush_hour",
}

_RUSH_HOURS = frozenset({7, 8, 9, 17, 18, 19, 20})


def model_input_dict(payload: ImpactPredictionRequest) -> dict[str, Any]:
    data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    base = {key: data[key] for key in MODEL_FEATURE_KEYS - {"is_weekend", "rush_hour"}}
    # Derived features — not in payload, computed from existing fields
    base["is_weekend"] = int(payload.day_of_week >= 5)
    base["rush_hour"]  = int(payload.hour in _RUSH_HOURS)
    return base


def resolve_pipeline_mode(payload: ImpactPredictionRequest) -> str:
    if payload.pipeline_mode:
        return payload.pipeline_mode
    return "planned" if payload.event_type == "planned" else "unplanned"


def build_idempotency_key(
    payload: ImpactPredictionRequest,
    model_version: str,
) -> str:
    if payload.idempotency_key:
        return payload.idempotency_key

    stable_payload = {
        "model_version": model_version,
        "pipeline_mode": resolve_pipeline_mode(payload),
        "model_input": model_input_dict(payload),
    }
    encoded_payload = json.dumps(stable_payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded_payload.encode("utf-8")).hexdigest()
