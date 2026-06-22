import json
from contextlib import contextmanager
from uuid import uuid4

from psycopg.rows import dict_row

from app.core.config import get_database_url
from app.core.database import get_pool
from app.schemas import CitizenGrievanceCreateRequest, CitizenGrievanceResponse, GrievanceStatusUpdateRequest
from app.services.grievance_agent import triage_grievance
from app.services.mapmyindia_client import mapmyindia_client
from app.services.event_queue import event_queue
from app.services.cache import cache, GRIEVANCES_LIST
from app.services.email_service import send_complaint_confirmation, send_status_update


import logging as _logging

_log = _logging.getLogger("drishti.grievance")

_EVALUATION_MSG = json.dumps({
    "text": (
        "Your complaint has been registered. Our AI system is currently evaluating it. "
        "If your report describes a genuine traffic incident, it will be actioned immediately. "
        "If found to be inaccurate or spam, it will be permanently removed from the system."
    ),
    "duration_min": None,
    "duration_hrs": None,
    "personnel": None,
    "urgency": None,
    "detected_cause": None,
    "detected_veh_type": None,
}, ensure_ascii=False)

_RETURNING = """
    id, tracking_id, complaint_type, severity, location_text,
    zone, corridor, latitude, longitude, description, status,
    agent_priority_score, agent_recommendation, created_at
"""


class GrievanceRejectedError(Exception):
    """Raised when the LLM firewall rejects the complaint description."""


@contextmanager
def _db_conn(database_url: str):
    """Use pool when initialised, fall back to a direct connection."""
    try:
        pool = get_pool()
        with pool.connection() as conn:
            conn.row_factory = dict_row
            yield conn
    except RuntimeError:
        import psycopg
        with psycopg.connect(database_url, row_factory=dict_row) as conn:
            yield conn


class GrievanceRepository:
    def __init__(self) -> None:
        self.database_url = get_database_url()

    @property
    def is_enabled(self) -> bool:
        return bool(self.database_url)

    def _find_nearby_duplicate(self, lat: float | None, lng: float | None, location_text: str) -> str | None:
        """Return existing tracking_id if an open complaint within ~300m exists in the last 30 min."""
        if not self.database_url:
            return None
        with _db_conn(self.database_url) as conn:
            with conn.cursor() as cur:
                if lat is not None and lng is not None:
                    cur.execute(
                        """
                        select tracking_id from citizen_grievances
                        where status not in ('rejected', 'evaluating', 'resolved', 'closed')
                          and created_at > now() - interval '30 minutes'
                          and latitude  is not null
                          and abs(latitude  - %(lat)s) < 0.003
                          and abs(longitude - %(lng)s) < 0.003
                        limit 1
                        """,
                        {"lat": lat, "lng": lng},
                    )
                else:
                    cur.execute(
                        """
                        select tracking_id from citizen_grievances
                        where status not in ('rejected', 'evaluating', 'resolved', 'closed')
                          and created_at > now() - interval '30 minutes'
                          and lower(location_text) = lower(%(loc)s)
                        limit 1
                        """,
                        {"loc": location_text},
                    )
                row = cur.fetchone()
                return row["tracking_id"] if row else None

    def create_instant(self, payload: CitizenGrievanceCreateRequest) -> CitizenGrievanceResponse:
        """Insert a placeholder record immediately and return the tracking ID.
        Full ML triage and firewall validation run via process_async() in the background."""
        if not self.database_url:
            raise RuntimeError("Database is not configured")

        import psycopg

        # Deduplication — check for same location in last 30 min
        dup = self._find_nearby_duplicate(
            payload.latitude, payload.longitude, payload.location_text or ""
        )
        if dup:
            raise GrievanceRejectedError(
                f"An incident at this location is already being handled (ref: {dup}). "
                "Track it instead of submitting a duplicate."
            )

        tracking_id = f"DRS-BTP-{uuid4().hex[:10].upper()}"
        payload_data = self._to_dict(payload)

        with _db_conn(self.database_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    insert into citizen_grievances (
                        tracking_id, reporter_name, reporter_phone, reporter_email,
                        complaint_type, severity, location_text, zone, corridor,
                        latitude, longitude, description, status,
                        agent_priority_score, agent_recommendation, nlp_extracted_at
                    ) values (
                        %(tracking_id)s, %(reporter_name)s, %(reporter_phone)s, %(reporter_email)s,
                        %(complaint_type)s, 'Low', %(location_text)s, %(zone)s, %(corridor)s,
                        %(latitude)s, %(longitude)s, %(description)s, 'evaluating',
                        0, %(agent_recommendation)s, now()
                    ) returning {_RETURNING}
                    """,
                    {**payload_data, "tracking_id": tracking_id, "agent_recommendation": _EVALUATION_MSG},
                )
                row = cur.fetchone()

        cache.delete(GRIEVANCES_LIST)
        result = CitizenGrievanceResponse(**row)
        # best-effort confirmation email
        if payload.reporter_email:
            send_complaint_confirmation(payload.reporter_email, tracking_id, payload.location_text or "")
        return result

    def process_async(self, tracking_id: str, payload: CitizenGrievanceCreateRequest) -> None:
        """Background task: run geocoding + ML triage + Gemini firewall.
        Deletes the record if rejected; updates it with full results if valid."""
        import psycopg
        import app.services.incident_predictor as _predictor

        try:
            # Step 1: keyword pre-filter — instant, no network
            if not _predictor._keyword_prefilter(payload.description or ""):
                self._delete_grievance(tracking_id, "not a traffic incident (keyword pre-filter)")
                return

            # Step 2: geocoding
            payload_data = self._to_dict(payload)
            geocode_result = None
            if payload.latitude is None or payload.longitude is None:
                geocode_query = " ".join(
                    p for p in [payload.location_text, payload.corridor, payload.zone, "Bengaluru", "Karnataka"]
                    if p
                )
                geocode_result = mapmyindia_client.geocode(geocode_query)
                if geocode_result:
                    payload_data["latitude"] = geocode_result.latitude
                    payload_data["longitude"] = geocode_result.longitude

            # Step 3: ML triage
            priority_score, recommendation, computed_severity = triage_grievance(
                CitizenGrievanceCreateRequest(**payload_data)
            )
            payload_data["severity"] = computed_severity
            nlp_features = self._training_features(payload_data, recommendation)

            # Step 4: Gemini firewall
            is_valid, fw_reason = _predictor.llm_firewall(payload.description or "")
            if not is_valid:
                self._delete_grievance(tracking_id, fw_reason)
                return

            # Step 5: update record with full ML results
            with _db_conn(self.database_url) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        update citizen_grievances set
                            severity                = %(severity)s,
                            status                  = 'submitted',
                            latitude                = %(latitude)s,
                            longitude               = %(longitude)s,
                            geocoding_provider      = %(geocoding_provider)s,
                            geocoding_confidence    = %(geocoding_confidence)s,
                            geocoding_raw           = %(geocoding_raw)s::jsonb,
                            agent_priority_score    = %(agent_priority_score)s,
                            agent_recommendation    = %(agent_recommendation)s,
                            nlp_event_cause         = %(nlp_event_cause)s,
                            nlp_vehicle_type        = %(nlp_vehicle_type)s,
                            nlp_event_type          = %(nlp_event_type)s,
                            nlp_priority            = %(nlp_priority)s,
                            nlp_requires_road_closure = %(nlp_requires_road_closure)s,
                            nlp_extracted_at        = now()
                        where upper(tracking_id) = upper(%(tracking_id)s)
                        returning id, zone, corridor, agent_priority_score
                        """,
                        {
                            "tracking_id"          : tracking_id,
                            "severity"             : computed_severity,
                            "latitude"             : payload_data.get("latitude"),
                            "longitude"            : payload_data.get("longitude"),
                            "geocoding_provider"   : "mapmyindia" if geocode_result else None,
                            "geocoding_confidence" : geocode_result.confidence if geocode_result else None,
                            "geocoding_raw"        : json.dumps(geocode_result.raw) if geocode_result else None,
                            "agent_priority_score" : priority_score,
                            "agent_recommendation" : recommendation,
                            **nlp_features,
                        },
                    )
                    row = cur.fetchone()
                    if row:
                        event_queue.publish(
                            "grievance.triaged",
                            tracking_id,
                            {
                                "grievance_id"        : str(row["id"]),
                                "tracking_id"         : tracking_id,
                                "severity"            : computed_severity,
                                "agent_priority_score": priority_score,
                                "zone"                : row["zone"],
                                "corridor"            : row["corridor"],
                            },
                            cursor=cur,
                        )

            cache.delete(GRIEVANCES_LIST)
            _log.info("Processed %s — severity=%s score=%d", tracking_id, computed_severity, priority_score)

        except Exception as exc:
            _log.exception("Background processing failed for %s: %s", tracking_id, exc)

    def _delete_grievance(self, tracking_id: str, reason: str) -> None:
        import psycopg
        try:
            with _db_conn(self.database_url) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "delete from citizen_grievances where upper(tracking_id) = upper(%s)",
                        (tracking_id,),
                    )
            cache.delete(GRIEVANCES_LIST)
            _log.info("Deleted grievance %s — reason: %s", tracking_id, reason)
        except Exception as exc:
            _log.warning("Could not delete %s: %s", tracking_id, exc)

    def create(self, payload: CitizenGrievanceCreateRequest) -> CitizenGrievanceResponse:
        """Synchronous create used by officer filing endpoint — runs triage inline."""
        if not self.database_url:
            raise RuntimeError("Database is not configured")

        import psycopg

        tracking_id = f"DRS-BTP-{uuid4().hex[:10].upper()}"
        payload_data = self._to_dict(payload)

        geocode_result = None
        if payload.latitude is None or payload.longitude is None:
            geocode_query = " ".join(
                p for p in [payload.location_text, payload.corridor, payload.zone, "Bengaluru", "Karnataka"]
                if p
            )
            geocode_result = mapmyindia_client.geocode(geocode_query)
            if geocode_result:
                payload_data["latitude"] = geocode_result.latitude
                payload_data["longitude"] = geocode_result.longitude

        priority_score, recommendation, computed_severity = triage_grievance(
            CitizenGrievanceCreateRequest(**payload_data)
        )
        payload_data["severity"] = computed_severity
        nlp_features = self._training_features(payload_data, recommendation)

        with _db_conn(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    insert into citizen_grievances (
                        tracking_id, reporter_name, reporter_phone, reporter_email,
                        complaint_type, severity, location_text, zone, corridor,
                        latitude, longitude, description,
                        geocoding_provider, geocoding_confidence, geocoding_raw,
                        agent_priority_score, agent_recommendation,
                        nlp_event_cause, nlp_vehicle_type, nlp_event_type,
                        nlp_priority, nlp_requires_road_closure, nlp_extracted_at
                    ) values (
                        %(tracking_id)s, %(reporter_name)s, %(reporter_phone)s, %(reporter_email)s,
                        %(complaint_type)s, %(severity)s, %(location_text)s, %(zone)s, %(corridor)s,
                        %(latitude)s, %(longitude)s, %(description)s,
                        %(geocoding_provider)s, %(geocoding_confidence)s, %(geocoding_raw)s::jsonb,
                        %(agent_priority_score)s, %(agent_recommendation)s,
                        %(nlp_event_cause)s, %(nlp_vehicle_type)s, %(nlp_event_type)s,
                        %(nlp_priority)s, %(nlp_requires_road_closure)s, now()
                    ) returning {_RETURNING}
                    """,
                    {
                        **payload_data,
                        "tracking_id"          : tracking_id,
                        "geocoding_provider"   : "mapmyindia" if geocode_result else None,
                        "geocoding_confidence" : geocode_result.confidence if geocode_result else None,
                        "geocoding_raw"        : json.dumps(geocode_result.raw) if geocode_result else None,
                        "agent_priority_score" : priority_score,
                        "agent_recommendation" : recommendation,
                        **nlp_features,
                    },
                )
                row = cursor.fetchone()
                event_queue.publish(
                    "grievance.created",
                    tracking_id,
                    {
                        "grievance_id"        : str(row["id"]),
                        "tracking_id"         : row["tracking_id"],
                        "complaint_type"      : row["complaint_type"],
                        "severity"            : row["severity"],
                        "zone"                : row["zone"],
                        "corridor"            : row["corridor"],
                        "status"              : row["status"],
                        "agent_priority_score": row["agent_priority_score"],
                        "created_at"          : str(row["created_at"]),
                    },
                    cursor=cursor,
                )
                cursor.execute(
                    """
                    insert into agent_actions (
                        aggregate_type, aggregate_id, agent_name, action_type, recommendation, confidence
                    ) values (
                        'citizen_grievances', %(id)s, 'grievance_triage_agent',
                        'triage_recommendation', %(recommendation)s, %(confidence)s
                    )
                    """,
                    {"id": row["id"], "recommendation": recommendation, "confidence": priority_score / 100},
                )

        cache.delete(GRIEVANCES_LIST)
        return CitizenGrievanceResponse(**row)

    def update_status(
        self, grievance_id: str, request: GrievanceStatusUpdateRequest
    ) -> CitizenGrievanceResponse | None:
        if not self.database_url:
            return None

        import psycopg

        with _db_conn(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    update citizen_grievances
                    set status = %s
                    where id = %s
                    returning
                        id, tracking_id, complaint_type, severity, location_text,
                        zone, corridor, latitude, longitude, description, status,
                        agent_priority_score, agent_recommendation,
                        reporter_phone, reporter_email, created_at
                    """,
                    (request.status, grievance_id),
                )
                row = cursor.fetchone()
                if row:
                    event_queue.publish(
                        "grievance.status_changed",
                        str(row["tracking_id"]),
                        {"grievance_id": str(row["id"]), "tracking_id": row["tracking_id"],
                         "new_status": row["status"], "severity": row["severity"],
                         "zone": row["zone"], "corridor": row["corridor"]},
                        cursor=cursor,
                    )

        cache.delete(GRIEVANCES_LIST)
        if row:
            if row.get("reporter_email"):
                send_status_update(
                    row["reporter_email"], row["tracking_id"],
                    row["status"], row["location_text"] or "",
                )
            # strip reporter_email before building response (not in schema)
            safe = {k: v for k, v in row.items() if k != "reporter_email"}
            return CitizenGrievanceResponse(**safe)
        return None

    def list_recent(self, limit: int = 50) -> list[CitizenGrievanceResponse]:
        if not self.database_url:
            return []

        cached = cache.get(GRIEVANCES_LIST)
        if cached is not None:
            return [CitizenGrievanceResponse(**item) for item in cached]

        import psycopg

        with _db_conn(self.database_url) as connection:
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

        with _db_conn(self.database_url) as connection:
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
