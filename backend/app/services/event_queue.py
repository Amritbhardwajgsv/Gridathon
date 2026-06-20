"""
In-process event queue backed by the PostgreSQL event_stream_outbox table.

Flow:
  1. publish(event_type, key, payload, cursor)
       Called INSIDE an existing DB transaction.
       Writes a 'pending' row to event_stream_outbox.
       Enqueues the event in-memory for immediate processing.

  2. Background worker thread drains the in-memory queue.
       Calls all handlers registered for the event_type.
       Marks the outbox row 'processed' or 'failed'.

  3. On startup, call start() to launch the worker.
       On shutdown, call stop().

  4. Register handlers with subscribe(event_type, handler).
       handler signature: handler(event: dict) -> None

Durability:
  - Events written to outbox survive a crash (pending rows).
  - On next startup, call replay_pending() to reprocess them.
"""
from __future__ import annotations

import json
import logging
import queue
import threading
from collections import defaultdict
from typing import Any, Callable

logger = logging.getLogger("drishti.queue")

Handler = Callable[[dict], None]


class EventQueue:
    def __init__(self) -> None:
        self._q: queue.Queue[dict] = queue.Queue()
        self._handlers: dict[str, list[Handler]] = defaultdict(list)
        self._worker_thread: threading.Thread | None = None
        self._running = False
        self._database_url: str | None = None

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def init(self, database_url: str | None) -> None:
        self._database_url = database_url

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            daemon=True,
            name="event-queue-worker",
        )
        self._worker_thread.start()
        logger.info("Event queue worker started")

    def stop(self) -> None:
        self._running = False
        self._q.put(None)   # poison pill to unblock the worker
        if self._worker_thread:
            self._worker_thread.join(timeout=5)
        logger.info("Event queue worker stopped")

    # ── Pub / Sub ─────────────────────────────────────────────────────────────

    def subscribe(self, event_type: str, handler: Handler) -> None:
        """Register a handler for an event type. Multiple handlers allowed."""
        self._handlers[event_type].append(handler)
        logger.debug("Handler registered for %s", event_type)

    def publish(
        self,
        event_type: str,
        key: str,
        payload: dict,
        cursor: Any | None = None,
    ) -> str | None:
        """
        Publish an event.
        If cursor is provided, writes to outbox in the SAME DB transaction
        before enqueueing (call this before the transaction commits).
        Returns the outbox row UUID (or None if DB write skipped).
        """
        event = {"event_type": event_type, "key": key, **payload}
        outbox_id = self._write_outbox(cursor, event_type, key, payload)
        event["_outbox_id"] = outbox_id
        self._q.put(event)
        logger.debug("Enqueued %s key=%s", event_type, key)
        return outbox_id

    # ── Internal ──────────────────────────────────────────────────────────────

    def _worker_loop(self) -> None:
        while self._running:
            try:
                event = self._q.get(timeout=1)
                if event is None:       # poison pill
                    break
                self._dispatch(event)
                self._q.task_done()
            except queue.Empty:
                continue
            except Exception:
                logger.exception("Event queue worker error")

    def _dispatch(self, event: dict) -> None:
        event_type = event.get("event_type", "unknown")
        outbox_id  = event.pop("_outbox_id", None)
        handlers   = self._handlers.get(event_type, [])

        if not handlers:
            logger.debug("No handlers for %s — marking processed", event_type)
            self._update_outbox(outbox_id, "processed")
            return

        failed = False
        for handler in handlers:
            try:
                handler(event)
            except Exception:
                logger.exception("Handler %s failed for %s", handler.__name__, event_type)
                failed = True

        self._update_outbox(outbox_id, "failed" if failed else "processed")

    def _write_outbox(
        self,
        cursor: Any | None,
        event_type: str,
        key: str,
        payload: dict,
    ) -> str | None:
        if cursor is None or self._database_url is None:
            return None
        try:
            cursor.execute(
                """
                insert into event_stream_outbox (topic, event_key, event_payload)
                values (%s, %s, %s::jsonb)
                returning id
                """,
                (event_type, key, json.dumps(payload, default=str)),
            )
            row = cursor.fetchone()
            return str(row["id"]) if row else None
        except Exception as exc:
            logger.warning("Outbox insert failed: %s", exc)
            return None

    def _update_outbox(self, outbox_id: str | None, status: str) -> None:
        if not outbox_id or not self._database_url:
            return
        try:
            import psycopg
            with psycopg.connect(self._database_url) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        update event_stream_outbox
                        set publish_status = %s,
                            published_at   = case when %s = 'processed' then now() else null end,
                            attempts       = attempts + 1
                        where id = %s
                        """,
                        (status, status, outbox_id),
                    )
        except Exception as exc:
            logger.warning("Outbox update failed: %s", exc)

    def replay_pending(self) -> int:
        """
        Re-enqueue any 'pending' outbox rows from a previous run.
        Call once after start() to recover from crashes.
        Returns the number of events replayed.
        """
        if not self._database_url:
            return 0
        try:
            import psycopg
            from psycopg.rows import dict_row
            with psycopg.connect(self._database_url, row_factory=dict_row) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        select id, topic, event_key, event_payload
                        from event_stream_outbox
                        where publish_status = 'pending'
                          and attempts < 3
                        order by created_at
                        limit 500
                        """
                    )
                    rows = cur.fetchall()

            for row in rows:
                payload = row["event_payload"] or {}
                event = {
                    "event_type"  : row["topic"],
                    "key"         : row["event_key"],
                    "_outbox_id"  : str(row["id"]),
                    **payload,
                }
                self._q.put(event)

            if rows:
                logger.info("Replayed %d pending outbox events", len(rows))
            return len(rows)
        except Exception as exc:
            logger.warning("Replay failed: %s", exc)
            return 0

    @property
    def queue_size(self) -> int:
        return self._q.qsize()


# Singleton
event_queue = EventQueue()
