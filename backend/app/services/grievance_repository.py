import json
from uuid import uuid4

from psycopg.rows import dict_row

from app.core.config import get_database_url
from app.schemas import CitizenGrievanceCreateRequest, CitizenGrievanceResponse, GrievanceStatusUpdateRequest
from app.services.grievance_agent import triage_grievance
from app.services.mapmyindia_client import mapmyindia_client
from app.services.event_queue import event_queue
from app.services.cache import cache, GRIEVANCES_LIST


class GrievanceRejectedError(Exception):
    """Raised when the LLM firewall rejects the complaint description."""


class GrievanceRepository:
    def __init__(self) -> None:
        self.database_url = get_database_url()

    @property
    def is_enabled(self) -> bool:
        return bool(self.database_url)

    def create(self, payload: CitizenGrievanceCreateRequest) -> CitizenGrievanceResponse:
        if not self.database_url:
            raise RuntimeError("Database is not configured")

        import psycopg

        tracking_id = f"DRS-BTP-{uuid4().hex[:10].upper()}"
        payload_data = self._to_dict(payload)

        # ── Keyword pre-filter (sync, instant) ───────────────────────────────
        # Rejects obviously non-traffic text before any DB insert.
        # Gemini validation runs async after the response is sent (see main.py).
        if payload.description and len(payload.description.strip()) >= 10:
            import app.services.incident_predictor as _predictor
            if not _predictor._keyword_prefilter(payload.description):
                raise GrievanceRejectedError("Input does not describe a road traffic incident.")

        geocode_result = None

        if payload.latitude is None or payload.longitude is None:
            geocode_query = " ".join(
                part
                for part in [
                    payload.location_text,
                    payload.corridor,
                    payload.zone,
                    "Bengaluru",
                    "Karnataka",
                ]
                if part
            )
            geocode_result = mapmyindia_client.geocode(geocode_query)
            if geocode_result:
                payload_data["latitude"] = geocode_result.latitude
                payload_data["longitude"] = geocode_result.longitude

        priority_score, recommendation, computed_severity = triage_grievance(
            CitizenGrievanceCreateRequest(**payload_data)
        )
        # Always use the model-computed severity (overrides any user-supplied value)
        payload_data["severity"] = computed_severity
        nlp_features = self._training_features(payload_data, recommendation)

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    insert into citizen_grievances (
                        tracking_id,
                        reporter_name,
                        reporter_phone,
                        reporter_email,
                        complaint_type,
                        severity,
                        location_text,
                        zone,
                        corridor,
                        latitude,
                        longitude,
                        description,
                        geocoding_provider,
                        geocoding_confidence,
                        geocoding_raw,
                        agent_priority_score,
                        agent_recommendation,
                        nlp_event_cause,
                        nlp_vehicle_type,
                        nlp_event_type,
                        nlp_priority,
                        nlp_requires_road_closure,
                        nlp_extracted_at
                    )
                    values (
                        %(tracking_id)s,
                        %(reporter_name)s,
                        %(reporter_phone)s,
                        %(reporter_email)s,
                        %(complaint_type)s,
                        %(severity)s,
                        %(location_text)s,
                        %(zone)s,
                        %(corridor)s,
                        %(latitude)s,
                        %(longitude)s,
                        %(description)s,
                        %(geocoding_provider)s,
                        %(geocoding_confidence)s,
                        %(geocoding_raw)s::jsonb,
                        %(agent_priority_score)s,
                        %(agent_recommendation)s,
                        %(nlp_event_cause)s,
                        %(nlp_vehicle_type)s,
                        %(nlp_event_type)s,
                        %(nlp_priority)s,
                        %(nlp_requires_road_closure)s,
                        now()
                    )
                    returning
                        id,
                        tracking_id,
                        complaint_type,
                        severity,
                        location_text,
                        zone,
                        corridor,
                        latitude,
                        longitude,
                        description,
                        status,
                        agent_priority_score,
                        agent_recommendation,
                        created_at
                    """,
                    {
                        **payload_data,
                        "tracking_id": tracking_id,
                        "geocoding_provider": "mapmyindia" if geocode_result else None,
                        "geocoding_confidence": geocode_result.confidence
                        if geocode_result
                        else None,
                        "geocoding_raw": json.dumps(geocode_result.raw)
                        if geocode_result
                        else None,
                        "agent_priority_score": priority_score,
                        "agent_recommendation": recommendation,
                        **nlp_features,
                    },
                )
                row = cursor.fetchone()
                event_queue.publish(
                    "grievance.created",
                    tracking_id,
                    {
                        "grievance_id"       : str(row["id"]),
                        "tracking_id"        : row["tracking_id"],
                        "complaint_type"     : row["complaint_type"],
                        "severity"           : row["severity"],
                        "zone"               : row["zone"],
                        "corridor"           : row["corridor"],
                        "status"             : row["status"],
                        "agent_priority_score": row["agent_priority_score"],
                        "created_at"         : str(row["created_at"]),
                    },
                    cursor=cursor,
                )
                cursor.execute(
                    """
                    insert into agent_actions (
                        aggregate_type,
                        aggregate_id,
                        agent_name,
                        action_type,
                        recommendation,
                        confidence
                    )
                    values (
                        'citizen_grievances',
                        %(id)s,
                        'grievance_triage_agent',
                        'triage_recommendation',
                        %(recommendation)s,
                        %(confidence)s
                    )
                    """,
                    {
                        "id": row["id"],
                        "recommendation": recommendation,
                        "confidence": priority_score / 100,
                    },
                )

        cache.delete(GRIEVANCES_LIST)
        return CitizenGrievanceResponse(**row)

    def update_status(
        self, grievance_id: str, request: GrievanceStatusUpdateRequest
    ) -> CitizenGrievanceResponse | None:
        if not self.database_url:
            return None

        import psycopg

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    update citizen_grievances
                    set status = %s
                    where id = %s
                    returning
                        id,
                        tracking_id,
                        complaint_type,
                        severity,
                        location_text,
                        zone,
                        corridor,
                        latitude,
                        longitude,
                        description,
                        status,
                        agent_priority_score,
                        agent_recommendation,
                        reporter_phone,
                        created_at
                    """,
                    (request.status, grievance_id),
                )
                row = cursor.fetchone()
                if row:
                    event_queue.publish(
                        "grievance.status_changed",
                        str(row["tracking_id"]),
                        {
                            "grievance_id": str(row["id"]),
                            "tracking_id" : row["tracking_id"],
                            "new_status"  : row["status"],
                            "severity"    : row["severity"],
                            "zone"        : row["zone"],
                            "corridor"    : row["corridor"],
                        },
                        cursor=cursor,
                    )

        cache.delete(GRIEVANCES_LIST)
        return CitizenGrievanceResponse(**row) if row else None

    def list_recent(self, limit: int = 50) -> list[CitizenGrievanceResponse]:
        if not self.database_url:
            return []

        cached = cache.get(GRIEVANCES_LIST)
        if cached is not None:
            return [CitizenGrievanceResponse(**item) for item in cached]

        import psycopg

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select
                        id,
                        tracking_id,
                        complaint_type,
                        severity,
                        location_text,
                        zone,
                        corridor,
                        latitude,
                        longitude,
                        description,
                        status,
                        agent_priority_score,
                        agent_recommendation,
                        reporter_phone,
                        created_at
                    from citizen_grievances
                    order by created_at desc
                    limit %s
                    """,
                    (limit,),
                )
                rows = cursor.fetchall()

        cache.set(GRIEVANCES_LIST, [dict(r) for r in rows], ttl=20)
        return [CitizenGrievanceResponse(**row) for row in rows]

    def get_by_tracking_id(self, tracking_id: str) -> CitizenGrievanceResponse | None:
        if not self.database_url:
            return None

        import psycopg

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select
                        id,
                        tracking_id,
                        complaint_type,
                        severity,
                        location_text,
                        zone,
                        corridor,
                        latitude,
                        longitude,
                        description,
                        status,
                        agent_priority_score,
                        agent_recommendation,
                        created_at
                    from citizen_grievances
                    where upper(tracking_id) = upper(%s)
                    limit 1
                    """,
                    (tracking_id.strip(),),
                )
                row = cursor.fetchone()

        return CitizenGrievanceResponse(**row) if row else None

    def validate_async(self, tracking_id: str, description: str) -> None:
        """Background task: run Gemini firewall and delete the record if rejected.
        Called after the HTTP response has already been sent, so latency doesn't matter."""
        import logging
        import app.services.incident_predictor as _predictor
        log = logging.getLogger("drishti.firewall")
        try:
            is_valid, reason = _predictor.llm_firewall(description)
            if is_valid:
                return
            # Gemini rejected — delete the complaint entirely
            import psycopg
            with psycopg.connect(self.database_url, row_factory=dict_row) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "delete from citizen_grievances where upper(tracking_id) = upper(%s)",
                        (tracking_id,),
                    )
            cache.delete(GRIEVANCES_LIST)
            log.info("Firewall async deleted %s (not a traffic incident): %s", tracking_id, reason)
        except Exception as exc:
            log.warning("Async firewall check failed for %s: %s", tracking_id, exc)

    @staticmethod
    def _to_dict(payload: CitizenGrievanceCreateRequest) -> dict:
        return payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()

    @staticmethod
    def _training_features(payload_data: dict, recommendation: str) -> dict:
        """Convert NLP inference into stable, model-ready database columns."""
        try:
            inference = json.loads(recommendation)
        except (TypeError, json.JSONDecodeError):
            inference = {}

        description = str(payload_data.get("description") or "").lower()
        complaint_type = str(payload_data.get("complaint_type") or "other")
        cause_fallback = {
            "accident_or_breakdown": "accident",
            "road_closure": "road_conditions",
            "event_congestion": "public_event",
            "signal_failure": "others",
            "illegal_parking": "others",
            "other": "others",
        }
        road_terms = ("closed", "blocked", "barricade", "diversion", "no entry")
        severity = str(payload_data.get("severity") or "Low")

        return {
            "nlp_event_cause": inference.get("detected_cause")
            or cause_fallback.get(complaint_type, "others"),
            "nlp_vehicle_type": inference.get("detected_veh_type") or "unknown",
            "nlp_event_type": "unplanned",
            "nlp_priority": "High" if severity in {"High", "Critical"} else "Low",
            "nlp_requires_road_closure": complaint_type == "road_closure"
            or any(term in description for term in road_terms),
        }
