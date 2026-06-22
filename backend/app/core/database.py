"""
Singleton psycopg connection pool.
Import `get_pool()` anywhere you need a DB connection.
"""
from __future__ import annotations

import logging
from typing import Any

_pool: Any = None
_log  = logging.getLogger("drishti.db")


def init_pool(database_url: str) -> None:
    global _pool
    if _pool is not None:
        return
    from psycopg_pool import ConnectionPool
    _pool = ConnectionPool(
        conninfo=database_url,
        min_size=2,
        max_size=10,
        open=True,
    )
    _log.info("psycopg ConnectionPool opened (min=2 max=10)")


def get_pool():
    if _pool is None:
        raise RuntimeError("DB pool not initialised — call init_pool() at startup")
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
        _log.info("psycopg ConnectionPool closed")
