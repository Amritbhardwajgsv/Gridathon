import json
from typing import Any

from app.core.config import get_database_url
from app.schemas import (
    ImpactPredictionRequest,
    ImpactPredictionResponse,
    OperationsSummaryResponse,
    RecentPredictionResponse,
)
from app.services.operational_policy import (
    build_idempotency_key,
    model_input_dict,
    resolve_pipeline_mode,
)


class PredictionRepository:
    def __init__(self) -> None:
        self.database_url = get_database_url()

    @property
    def is_enabled(self) -> bool:
        return bool(self.database_url)

    def save_prediction(
        self,
        payload: ImpactPredictionRequest,
        result: ImpactPredictionResponse,
        source: str = "frontend_operator",
        user_id: str | None = None,
    ) -> None:
        if not self.database_url:
            return

        try:
            import psycopg
        except ImportError:
            return

        payload_data = self._to_dict(payload)
        result_data = self._to_dict(result)
        model_data = model_input_dict(payload)
        pipeline_mode = resolve_pipeline_mode(payload)
        idempotency_key = build_idempotency_key(payload, result.model_version)

        try:
            with psycopg.connect(self.database_url) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        insert into prediction_events (
                            event_cause_grouped,
                            event_type,
                            priority,
                            requires_road_closure,
                            corridor,
                            zone,
                            latitude,
                            longitude,
                            hour,
                            day_of_week,
                            month,
                            predicted_duration_minutes,
                            impact_level,
                            model_version,
                            request_payload,
                            response_payload,
                            source,
                            pipeline_mode,
                            idempotency_key,
                            operator_override_notes,
                            created_by_user_id,
                            nlp_signal,
                            resource_recommendation,
                            learning_signal,
                            event_name,
                            estimated_crowd_size,
                            operational_description
                        )
                        values (
                            %(event_cause_grouped)s,
                            %(event_type)s,
                            %(priority)s,
                            %(requires_road_closure)s,
                            %(corridor)s,
                            %(zone)s,
                            %(latitude)s,
                            %(longitude)s,
                            %(hour)s,
                            %(day_of_week)s,
                            %(month)s,
                            %(predicted_duration_minutes)s,
                            %(impact_level)s,
                            %(model_version)s,
                            %(request_payload)s::jsonb,
                            %(response_payload)s::jsonb,
                            %(source)s,
                            %(pipeline_mode)s,
                            %(idempotency_key)s,
                            %(operator_override_notes)s,
                            %(created_by_user_id)s,
                            %(nlp_signal)s::jsonb,
                            %(resource_recommendation)s::jsonb,
                            %(learning_signal)s::jsonb,
                            %(event_name)s,
                            %(estimated_crowd_size)s,
                            %(operational_description)s
                        )
                        on conflict (idempotency_key) do nothing
                        """,
                        {
                            **model_data,
                            **result_data,
                            "request_payload": json.dumps(model_data),
                            "response_payload": json.dumps(result_data),
                            "source": source,
                            "pipeline_mode": pipeline_mode,
                            "idempotency_key": idempotency_key,
                            "operator_override_notes": payload_data.get(
                                "operator_override_notes"
                            ),
                            "created_by_user_id": user_id,
                            "nlp_signal": json.dumps(result_data.get("nlp_signal")),
                            "resource_recommendation": json.dumps(
                                result_data.get("resource_recommendation")
                            ),
                            "learning_signal": json.dumps(result_data.get("learning_signal")),
                            "event_name": payload_data.get("event_name"),
                            "estimated_crowd_size": payload_data.get("estimated_crowd_size"),
                            "operational_description": payload_data.get(
                                "operational_description"
                            ),
                        },
                    )
                    cursor.execute(
                        """
                        insert into drishti_event_log (
                            aggregate_type,
                            aggregate_key,
                            event_type,
                            event_payload
                        )
                        values (
                            'prediction_events',
                            %(idempotency_key)s,
                            'prediction_requested',
                            %(event_payload)s::jsonb
                        )
                        """,
                        {
                            "idempotency_key": idempotency_key,
                            "event_payload": json.dumps(
                                {
                                    "pipeline_mode": pipeline_mode,
                                    "source": source,
                                    "request_payload": model_data,
                                    "response_payload": result_data,
                                }
                            ),
                        },
                    )
        except Exception:
            return

    def operations_summary(self) -> OperationsSummaryResponse:
        empty = OperationsSummaryResponse(
            prediction_count=0,
            grievance_count=0,
            retraining_ready_count=0,
            impact_counts={},
            severity_counts={},
            recent_predictions=[],
        )
        if not self.database_url:
            return empty

        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError:
            return empty

        try:
            with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("select count(*) as count from prediction_events")
                    prediction_count = int(cursor.fetchone()["count"])

                    cursor.execute("select count(*) as count from citizen_grievances")
                    grievance_count = int(cursor.fetchone()["count"])

                    cursor.execute(
                        """
                        select count(*) as count
                        from prediction_events
                        where eligible_for_retraining = true
                          and used_for_retraining = false
                        """
                    )
                    retraining_ready_count = int(cursor.fetchone()["count"])

                    cursor.execute(
                        """
                        select impact_level, count(*) as count
                        from prediction_events
                        group by impact_level
                        """
                    )
                    impact_counts = {
                        row["impact_level"]: int(row["count"])
                        for row in cursor.fetchall()
                    }

                    cursor.execute(
                        """
                        select severity, count(*) as count
                        from citizen_grievances
                        group by severity
                        """
                    )
                    severity_counts = {
                        row["severity"]: int(row["count"])
                        for row in cursor.fetchall()
                    }

                    cursor.execute(
                        """
                        select
                            id,
                            event_name,
                            event_cause_grouped,
                            event_type,
                            priority,
                            corridor,
                            zone,
                            predicted_duration_minutes,
                            impact_level,
                            model_version,
                            pipeline_mode,
                            created_at
                        from prediction_events
                        order by created_at desc
                        limit 10
                        """
                    )
                    recent_predictions = [
                        RecentPredictionResponse(**row)
                        for row in cursor.fetchall()
                    ]

            return OperationsSummaryResponse(
                prediction_count=prediction_count,
                grievance_count=grievance_count,
                retraining_ready_count=retraining_ready_count,
                impact_counts=impact_counts,
                severity_counts=severity_counts,
                recent_predictions=recent_predictions,
            )
        except Exception:
            return empty

    @staticmethod
    def _to_dict(model: Any) -> dict[str, Any]:
        return model.model_dump() if hasattr(model, "model_dump") else model.dict()
