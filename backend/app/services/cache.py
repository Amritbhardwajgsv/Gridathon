"""
Redis-backed cache for frequently-read, rarely-changed data.

Usage:
    from app.services.cache import cache

    # read
    data = cache.get("drishti:grievances:list")

    # write
    cache.set("drishti:grievances:list", serialisable_value, ttl=20)

    # invalidate one key
    cache.delete("drishti:grievances:list")

    # invalidate all keys sharing a prefix
    cache.delete_prefix("drishti:deployments:")

Graceful degradation: every method is a no-op if Redis is unavailable —
the caller falls through to the DB query as normal.

Key catalogue (TTL seconds):
    drishti:grievances:list       20
    drishti:personnel:list        30
    drishti:deployments:list      15
    drishti:ops:summary           30
    drishti:logs:list             60
    drishti:users:list            60
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger("drishti.cache")

_client = None
_unavailable = False


def _get_client():
    global _client, _unavailable
    if _unavailable:
        return None
    if _client is not None:
        return _client

    from app.core.config import get_redis_url
    url = get_redis_url()
    if not url:
        logger.debug("REDIS_URL not set — response cache disabled")
        _unavailable = True
        return None

    try:
        import redis as _redis
        _client = _redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
        _client.ping()
        logger.info("Response cache connected to Redis at %s", url.split("@")[-1])
        return _client
    except Exception as exc:
        logger.warning("Redis unavailable — response cache disabled: %s", exc)
        _unavailable = True
        return None


class _Cache:
    def get(self, key: str) -> Any | None:
        client = _get_client()
        if client is None:
            return None
        try:
            raw = client.get(key)
            if raw is None:
                return None
            value = json.loads(raw)
            logger.debug("cache HIT  %s", key)
            return value
        except Exception as exc:
            logger.debug("cache get error %s: %s", key, exc)
            return None

    def set(self, key: str, value: Any, ttl: int = 30) -> None:
        client = _get_client()
        if client is None:
            return
        try:
            client.setex(key, ttl, json.dumps(value, default=str))
            logger.debug("cache SET  %s (ttl=%ds)", key, ttl)
        except Exception as exc:
            logger.debug("cache set error %s: %s", key, exc)

    def delete(self, *keys: str) -> None:
        client = _get_client()
        if client is None:
            return
        try:
            client.delete(*keys)
            logger.debug("cache DEL  %s", keys)
        except Exception as exc:
            logger.debug("cache delete error %s: %s", keys, exc)

    def delete_prefix(self, prefix: str) -> None:
        """Delete all keys whose name starts with `prefix`."""
        client = _get_client()
        if client is None:
            return
        try:
            keys = client.keys(f"{prefix}*")
            if keys:
                client.delete(*keys)
                logger.debug("cache DEL prefix=%s (%d keys)", prefix, len(keys))
        except Exception as exc:
            logger.debug("cache delete_prefix error %s: %s", prefix, exc)


cache = _Cache()

# ── Stable key constants ───────────────────────────────────────────────────────
GRIEVANCES_LIST  = "drishti:grievances:list"
PERSONNEL_LIST   = "drishti:personnel:list"
DEPLOYMENTS_LIST = "drishti:deployments:list"
OPS_SUMMARY      = "drishti:ops:summary"
LOGS_LIST        = "drishti:logs:list"
USERS_LIST       = "drishti:users:list"
