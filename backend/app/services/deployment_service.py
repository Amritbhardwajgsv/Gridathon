import json
import math
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from psycopg.rows import dict_row

from app.core.config import get_database_url
from app.schemas import (
    DeploymentOrderCreateRequest,
    DeploymentOrderResponse,
    DeploymentStatusUpdateRequest,
    FieldAssignmentResponse,
    PersonnelLocationUpdateRequest,
    PersonnelLocationUpdateResponse,
    PolicePersonnelCreateRequest,
    PolicePersonnelResponse,
)


class DeploymentService:
    def __init__(self) -> None:
        self.database_url = get_database_url()
        self._schema_checked = False

    def create_personnel(
        self, payload: PolicePersonnelCreateRequest, created_by_user_id: str
    ) -> PolicePersonnelResponse:
        self._require_database()
        import psycopg

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    insert into police_personnel (
                        badge_id,
                        name,
                        rank,
                        unit_name,
                        zone,
                        phone,
                        whatsapp_phone,
                        current_latitude,
                        current_longitude,
                        last_location_at,
                        created_by_user_id
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, now(), %s)
                    returning
                        id,
                        badge_id,
                        name,
                        rank,
                        unit_name,
                        zone,
                        phone,
                        whatsapp_phone,
                        current_latitude,
                        current_longitude,
                        last_location_at,
                        is_available,
                        is_active,
                        created_at
                    """,
                    (
                        payload.badge_id.strip(),
                        payload.name.strip(),
                        payload.rank,
                        payload.unit_name.strip(),
                        payload.zone,
                        payload.phone,
                        payload.whatsapp_phone or payload.phone,
                        payload.current_latitude,
                        payload.current_longitude,
                        created_by_user_id,
                    ),
                )
                row = cursor.fetchone()
        return PolicePersonnelResponse(**row)

    def list_personnel(self) -> list[PolicePersonnelResponse]:
        self._require_database()
        import psycopg

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select
                        id,
                        badge_id,
                        name,
                        rank,
                        unit_name,
                        zone,
                        phone,
                        whatsapp_phone,
                        current_latitude,
                        current_longitude,
                        last_location_at,
                        is_available,
                        is_active,
                        created_at
                    from police_personnel
                    where is_active = true
                    order by is_available desc, rank, name
                    """
                )
                rows = cursor.fetchall()
        return [PolicePersonnelResponse(**row) for row in rows]

    def create_order(
        self, payload: DeploymentOrderCreateRequest, commander_user_id: str
    ) -> DeploymentOrderResponse:
        self._require_database()
        import psycopg

        order_number = f"DRS-DEP-{uuid4().hex[:10].upper()}"

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select
                        id,
                        tracking_id,
                        severity,
                        zone,
                        corridor,
                        latitude,
                        longitude,
                        location_text,
                        agent_priority_score,
                        agent_recommendation
                    from citizen_grievances
                    where id = %s
                    """,
                    (payload.grievance_id,),
                )
                grievance = cursor.fetchone()
                if not grievance:
                    raise ValueError("Complaint not found")

                personnel_ids = payload.personnel_ids
                if payload.auto_assign_nearest and not personnel_ids:
                    personnel_ids = self._nearest_personnel_ids(
                        latitude=grievance.get("latitude"),
                        longitude=grievance.get("longitude"),
                        limit=payload.required_personnel_count,
                    )

                resource_recommendation = {
                    "source": "complaint_signal",
                    "agent_priority_score": grievance["agent_priority_score"],
                    "agent_recommendation": grievance["agent_recommendation"],
                    "assignment_mode": "nearest_location" if payload.auto_assign_nearest else "manual",
                    "assigned_personnel_count": len(personnel_ids),
                }
                notification_payload = {
                    "channel": "whatsapp",
                    "complaint_tracking_id": grievance.get("tracking_id"),
                    "location_text": grievance.get("location_text"),
                    "message": (
                        f"DRISHTI deployment {order_number}: report to "
                        f"{grievance.get('location_text')} / {grievance.get('corridor')}. "
                        f"Brief: {payload.field_brief}"
                    ),
                }

                cursor.execute(
                    """
                    insert into deployment_orders (
                        order_number,
                        grievance_id,
                        commander_user_id,
                        corridor,
                        zone,
                        priority,
                        status,
                        resource_recommendation,
                        notification_payload,
                        deployment_latitude,
                        deployment_longitude,
                        field_brief
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s)
                    returning
                        id,
                        order_number,
                        grievance_id,
                        corridor,
                        zone,
                        priority,
                        status,
                        resource_recommendation,
                        notification_payload,
                        deployment_latitude,
                        deployment_longitude,
                        field_brief,
                        created_at
                    """,
                    (
                        order_number,
                        payload.grievance_id,
                        commander_user_id,
                        grievance["corridor"] or "Unmapped corridor",
                        grievance["zone"] or "Unmapped zone",
                        grievance["severity"],
                        payload.status,
                        json.dumps(resource_recommendation),
                        json.dumps(notification_payload),
                        grievance.get("latitude"),
                        grievance.get("longitude"),
                        payload.field_brief,
                    ),
                )
                order = cursor.fetchone()

                for personnel_id in personnel_ids:
                    cursor.execute(
                        """
                        insert into deployment_order_personnel (
                            deployment_order_id,
                            personnel_id,
                            assignment_role
                        )
                        values (%s, %s, 'field deployment')
                        on conflict do nothing
                        """,
                        (order["id"], personnel_id),
                    )
                    cursor.execute(
                        "update police_personnel set is_available = false where id = %s",
                        (personnel_id,),
                    )

        return self._hydrate_order(order)

    def list_orders(self) -> list[DeploymentOrderResponse]:
        self._require_database()
        import psycopg

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select
                        id,
                        order_number,
                        grievance_id,
                        corridor,
                        zone,
                        priority,
                        status,
                        resource_recommendation,
                        notification_payload,
                        deployment_latitude,
                        deployment_longitude,
                        field_brief,
                        created_at
                    from deployment_orders
                    order by created_at desc
                    limit 50
                    """
                )
                rows = cursor.fetchall()
        return [self._hydrate_order(row) for row in rows]

    def update_order_status(
        self, order_id: str, request: DeploymentStatusUpdateRequest
    ) -> DeploymentOrderResponse:
        self._require_database()
        import psycopg

        terminal_statuses = {"resolved", "cancelled"}
        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    update deployment_orders
                    set status = %s
                    where id = %s
                    returning
                        id,
                        order_number,
                        grievance_id,
                        corridor,
                        zone,
                        priority,
                        status,
                        resource_recommendation,
                        notification_payload,
                        deployment_latitude,
                        deployment_longitude,
                        field_brief,
                        created_at
                    """,
                    (request.status, order_id),
                )
                row = cursor.fetchone()
                if not row:
                    raise ValueError("Deployment order not found")

                if request.status in terminal_statuses:
                    cursor.execute(
                        """
                        update police_personnel p
                        set is_available = true
                        from deployment_order_personnel dop
                        where dop.deployment_order_id = %s
                          and dop.personnel_id = p.id
                        """,
                        (order_id,),
                    )

                # When officer resolves, move grievance to pending_verification
                # so Command Centre must confirm before it is marked resolved
                if request.status == "resolved" and row.get("grievance_id"):
                    cursor.execute(
                        """
                        update citizen_grievances
                        set status = 'pending_verification'
                        where id = %s
                          and status not in ('resolved', 'closed', 'pending_verification')
                        """,
                        (str(row["grievance_id"]),),
                    )

        return self._hydrate_order(row)

    def _hydrate_order(self, row: dict) -> DeploymentOrderResponse:
        assigned_personnel = self._assigned_personnel(str(row["id"]))
        return DeploymentOrderResponse(
            **row,
            assigned_personnel=assigned_personnel,
        )

    def _assigned_personnel(self, order_id: str) -> list[PolicePersonnelResponse]:
        import psycopg

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select
                        p.id,
                        p.badge_id,
                        p.name,
                        p.rank,
                        p.unit_name,
                        p.zone,
                        p.phone,
                        p.whatsapp_phone,
                        p.current_latitude,
                        p.current_longitude,
                        p.last_location_at,
                        p.is_available,
                        p.is_active,
                        p.created_at
                    from deployment_order_personnel dop
                    join police_personnel p on p.id = dop.personnel_id
                    where dop.deployment_order_id = %s
                    order by p.rank, p.name
                    """,
                    (order_id,),
                )
                rows = cursor.fetchall()
        return [PolicePersonnelResponse(**row) for row in rows]

    def remove_personnel(self, personnel_id: str) -> None:
        self._require_database()
        import psycopg

        with psycopg.connect(self.database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    update police_personnel
                    set is_active = false,
                        is_available = false
                    where id = %s
                    """,
                    (personnel_id,),
                )

    def update_location_by_badge(
        self, badge_id: str, payload: PersonnelLocationUpdateRequest
    ) -> PersonnelLocationUpdateResponse:
        self._require_database()
        import psycopg

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    update police_personnel
                    set
                        current_latitude = %s,
                        current_longitude = %s,
                        last_location_at = now()
                    where lower(badge_id) = lower(%s)
                      and is_active = true
                    returning
                        badge_id,
                        name,
                        current_latitude,
                        current_longitude,
                        last_location_at
                    """,
                    (payload.latitude, payload.longitude, badge_id),
                )
                row = cursor.fetchone()
        if not row:
            raise ValueError("Police personnel badge not found")
        return PersonnelLocationUpdateResponse(**row)

    def field_assignments_by_badge(self, badge_id: str) -> list[FieldAssignmentResponse]:
        self._require_database()
        import psycopg

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select
                        d.id as order_id,
                        d.order_number,
                        d.status,
                        d.priority,
                        d.corridor,
                        d.zone,
                        d.deployment_latitude,
                        d.deployment_longitude,
                        d.field_brief,
                        d.notification_payload,
                        g.tracking_id as complaint_tracking_id,
                        g.complaint_type,
                        g.severity as complaint_severity,
                        g.location_text as complaint_location,
                        g.description as complaint_description,
                        d.created_at
                    from deployment_orders d
                    join deployment_order_personnel dop
                        on dop.deployment_order_id = d.id
                    join police_personnel p
                        on p.id = dop.personnel_id
                    left join citizen_grievances g
                        on g.id = d.grievance_id
                    where lower(p.badge_id) = lower(%s)
                      and d.status in ('issued', 'in_progress', 'enroute', 'onscene')
                    order by d.created_at desc
                    limit 20
                    """,
                    (badge_id,),
                )
                rows = cursor.fetchall()
        return [FieldAssignmentResponse(**row) for row in rows]

    def _nearest_personnel_ids(
        self,
        latitude: float | None,
        longitude: float | None,
        limit: int,
    ) -> list[str]:
        available = self.list_personnel()
        available = [person for person in available if person.is_available]
        if latitude is None or longitude is None:
            return [str(person.id) for person in available[:limit]]

        cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
        fresh_available = []
        for person in available:
            last_seen = person.last_location_at
            if last_seen is None:
                continue
            if last_seen.tzinfo is None:
                last_seen = last_seen.replace(tzinfo=timezone.utc)
            if last_seen >= cutoff:
                fresh_available.append(person)
        ranking_pool = fresh_available or available
        ranked = sorted(
            ranking_pool,
            key=lambda person: self._distance_km(
                latitude,
                longitude,
                person.current_latitude,
                person.current_longitude,
            ),
        )
        return [str(person.id) for person in ranked[:limit]]

    @staticmethod
    def _distance_km(
        lat1: float,
        lon1: float,
        lat2: float | None,
        lon2: float | None,
    ) -> float:
        if lat2 is None or lon2 is None:
            return 9999
        radius = 6371
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def _require_database(self) -> None:
        if not self.database_url:
            raise RuntimeError("Database is not configured")
        self._ensure_schema()

    def _ensure_schema(self) -> None:
        if self._schema_checked:
            return
        import psycopg

        try:
            with psycopg.connect(self.database_url) as conn:
                with conn.cursor() as cur:
                    # Widen the status check constraint to include escalated
                    cur.execute("""
                        do $$
                        begin
                            alter table deployment_orders
                                drop constraint if exists deployment_orders_status_check;
                            alter table deployment_orders
                                add constraint deployment_orders_status_check
                                check (status in (
                                    'draft','issued','in_progress',
                                    'enroute','onscene','resolved',
                                    'escalated','cancelled'
                                ));
                        exception when others then null;
                        end $$
                    """)
        except Exception:
            pass
        self._schema_checked = True


deployment_service = DeploymentService()
