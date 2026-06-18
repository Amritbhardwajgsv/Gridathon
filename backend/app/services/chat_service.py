import logging

import psycopg
from psycopg.rows import dict_row

from app.core.config import get_database_url

logger = logging.getLogger("drishti.chat")


class ChatService:
    def __init__(self) -> None:
        self.db_url = get_database_url()
        self._schema_ok = False

    def _ensure_schema(self) -> None:
        if self._schema_ok:
            return
        try:
            with psycopg.connect(self.db_url) as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        create table if not exists deployment_chat_messages (
                            id          text primary key default gen_random_uuid()::text,
                            deployment_id text not null,
                            sender_id   text not null,
                            sender_name text not null,
                            sender_role text not null,
                            message     text not null,
                            sent_at     timestamptz not null default now()
                        );
                        create index if not exists idx_dcm_deployment
                            on deployment_chat_messages (deployment_id, sent_at);
                    """)
            self._schema_ok = True
        except Exception:
            logger.warning("Chat schema init failed", exc_info=True)

    def get_messages(self, deployment_id: str, limit: int = 100) -> list[dict]:
        self._ensure_schema()
        with psycopg.connect(self.db_url, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select id, deployment_id, sender_id, sender_name, sender_role,
                           message, sent_at::text as sent_at
                    from deployment_chat_messages
                    where deployment_id = %s
                    order by sent_at asc
                    limit %s
                    """,
                    (deployment_id, limit),
                )
                return cur.fetchall() or []

    def save_message(
        self,
        deployment_id: str,
        sender_id: str,
        sender_name: str,
        sender_role: str,
        message: str,
    ) -> dict:
        self._ensure_schema()
        with psycopg.connect(self.db_url, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    insert into deployment_chat_messages
                        (deployment_id, sender_id, sender_name, sender_role, message)
                    values (%s, %s, %s, %s, %s)
                    returning id, deployment_id, sender_id, sender_name, sender_role,
                              message, sent_at::text as sent_at
                    """,
                    (deployment_id, sender_id, sender_name, sender_role, message),
                )
                return cur.fetchone()


chat_service = ChatService()
