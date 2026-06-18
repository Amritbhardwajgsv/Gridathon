import json
from uuid import uuid4

from psycopg.rows import dict_row

from app.core.config import get_database_url
from app.schemas import CitizenGrievanceCreateRequest, CitizenGrievanceResponse, GrievanceStatusUpdateRequest
from app.services.grievance_agent import triage_grievance
from app.services.mapmyindia_client import mapmyindia_client


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
                        agent_recommendation
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
                        %(agent_recommendation)s
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
                    },
                )
                row = cursor.fetchone()
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

        return CitizenGrievanceResponse(**row) if row else None

    def list_recent(self, limit: int = 50) -> list[CitizenGrievanceResponse]:
        if not self.database_url:
            return []

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

    @staticmethod
    def _to_dict(payload: CitizenGrievanceCreateRequest) -> dict:
        return payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
