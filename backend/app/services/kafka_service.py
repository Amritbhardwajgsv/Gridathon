"""
Kafka event publisher — transactional outbox pattern.

How it works:
  1. write_outbox(cursor, topic, key, payload)
       Called INSIDE an existing DB transaction.
       Inserts a pending record into event_stream_outbox.
       Returns the outbox row UUID.

  2. publish(topic, key, payload, outbox_id, db_url)
       Called AFTER the DB transaction commits.
       Sends the message to the Kafka broker.
       Updates the outbox record to 'published' or 'failed'.

Graceful degradation:
  - If KAFKA_BOOTSTRAP_SERVERS is not set → all calls are silent no-ops.
  - If the broker is unreachable → outbox row stays 'pending'; nothing breaks.
"""
from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any

logger = logging.getLogger("drishti.kafka")

_lock     = threading.Lock()
_producer: Any = None
_enabled: bool | None = None   # None = not yet checked


# ── Internal helpers ───────────────────────────────────────────────────────────

def _get_producer() -> Any:
    global _producer, _enabled
    if _enabled is False:
        return None
    with _lock:
        if _producer is not None:
            return _producer
        from app.core.config import get_kafka_bootstrap_servers
        servers = get_kafka_bootstrap_servers()
        if not servers:
            _enabled = False
            return None
        try:
            from kafka import KafkaProducer
            _producer = KafkaProducer(
                bootstrap_servers=servers,
                value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                acks="all",
                retries=3,
                request_timeout_ms=5_000,
                api_version_auto_timeout_ms=5_000,
            )
            _enabled = True
            logger.info("Kafka producer connected to %s", servers)
            return _producer
        except Exception as exc:
            logger.warning("Kafka producer init failed (%s) — publishing disabled", exc)
            _enabled = False
            return None


def _update_outbox_status(db_url: str, outbox_id: str, status: str) -> None:
    try:
        import psycopg
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    update event_stream_outbox
                    set publish_status = %s,
                        published_at   = case when %s = 'published' then now() else null end,
                        attempts       = attempts + 1
                    where id = %s
                    """,
                    (status, status, outbox_id),
                )
    except Exception as exc:
        logger.warning("Outbox status update failed: %s", exc)


# ── Public API ─────────────────────────────────────────────────────────────────

def write_outbox(cursor: Any, topic: str, key: str, payload: dict) -> str | None:
    """
    Write a pending outbox record in the same DB transaction as the main write.
    Returns the UUID of the outbox row (pass it to publish() after commit).
    """
    try:
        cursor.execute(
            """
            insert into event_stream_outbox (topic, event_key, event_payload)
            values (%s, %s, %s::jsonb)
            returning id
            """,
            (topic, key, json.dumps(payload, default=str)),
        )
        row = cursor.fetchone()
        return str(row["id"]) if row else None
    except Exception as exc:
        logger.warning("Outbox insert failed: %s", exc)
        return None


def publish(
    topic: str,
    key: str,
    payload: dict,
    outbox_id: str | None = None,
    db_url: str | None = None,
) -> None:
    """
    Publish to Kafka after the DB transaction has committed.
    Never raises — failures are logged and recorded in the outbox.
    """
    producer = _get_producer()
    if producer is None:
        return

    status = "failed"
    try:
        future = producer.send(topic, key=key, value=payload)
        producer.flush(timeout=5)
        future.get(timeout=5)
        status = "published"
        logger.info("Kafka published  topic=%-28s key=%s", topic, key)
    except Exception as exc:
        logger.warning("Kafka publish failed  topic=%s key=%s  err=%s", topic, key, exc)

    if outbox_id and db_url:
        _update_outbox_status(db_url, outbox_id, status)


# ── Topic names (configurable via env) ────────────────────────────────────────

def topic_grievances() -> str:
    return os.getenv("KAFKA_TOPIC_GRIEVANCES", "drishti.grievances")

def topic_predictions() -> str:
    return os.getenv("KAFKA_TOPIC_PREDICTIONS", "drishti.predictions")

def topic_deployments() -> str:
    return os.getenv("KAFKA_TOPIC_DEPLOYMENTS", "drishti.deployments")
