"""Celery tasks — heavyweight async work moved off the FastAPI event loop."""
from __future__ import annotations

import logging

from app.celery_app import celery

_log = logging.getLogger("drishti.tasks")


@celery.task(bind=True, max_retries=3, default_retry_delay=30, name="tasks.process_grievance")
def process_grievance(self, tracking_id: str, payload_dict: dict) -> None:
    """Run geocoding + ML triage + Gemini firewall for a citizen grievance.

    Called right after create_instant() so the HTTP response is already sent.
    Falls back via Celery retry on transient errors.
    """
    from app.schemas import CitizenGrievanceCreateRequest
    from app.services.grievance_repository import GrievanceRepository

    try:
        payload = CitizenGrievanceCreateRequest(**payload_dict)
        repo = GrievanceRepository()
        repo.process_async(tracking_id, payload)
    except Exception as exc:
        _log.warning("Task process_grievance(%s) failed: %s — retrying", tracking_id, exc)
        raise self.retry(exc=exc)
