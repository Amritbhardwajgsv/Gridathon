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
}


def model_input_dict(payload: ImpactPredictionRequest) -> dict[str, Any]:
    data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    return {key: data[key] for key in MODEL_FEATURE_KEYS}


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
