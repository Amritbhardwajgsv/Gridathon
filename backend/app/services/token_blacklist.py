"""
Redis-backed JWT token blacklist.

On logout the token's JTI is stored in Redis with a TTL equal to the
token's remaining lifetime, so the blacklist self-cleans and never grows
unbounded.

If Redis is not configured (REDIS_URL absent) or the connection fails the
module degrades gracefully: tokens are not blacklisted server-side, but the
client-side session is still cleared.  This lets the app run without Redis
in development while the security guarantee holds whenever Redis is present.
"""

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_client = None          # redis.Redis instance, lazily created
_unavailable = False    # flip to True after first connection failure to stop retrying every request


def _get_client():
    global _client, _unavailable
    if _unavailable:
        return None
    if _client is not None:
        return _client

    from app.core.config import get_redis_url
    url = get_redis_url()
    if not url:
        logger.debug("REDIS_URL not set — token blacklist disabled")
        _unavailable = True
        return None

    try:
        import redis
        _client = redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
        _client.ping()
        logger.info("Redis token blacklist connected at %s", url.split("@")[-1])
        return _client
    except Exception as exc:
        logger.warning("Redis unavailable — token blacklist disabled: %s", exc)
        _unavailable = True
        return None


def blacklist_token(jti: str, exp: int) -> None:
    """Add a JTI to the blacklist until its natural expiry."""
    client = _get_client()
    if client is None:
        return

    now = int(datetime.now(timezone.utc).timestamp())
    ttl = max(exp - now, 1)          # seconds until token expires
    try:
        client.setex(f"bl:jti:{jti}", ttl, "1")
        logger.debug("Blacklisted jti=%s ttl=%ds", jti, ttl)
    except Exception as exc:
        logger.warning("Could not write to Redis blacklist: %s", exc)


def is_blacklisted(jti: str) -> bool:
    """Return True if the JTI has been blacklisted (token was logged out)."""
    client = _get_client()
    if client is None:
        return False

    try:
        return client.exists(f"bl:jti:{jti}") > 0
    except Exception as exc:
        logger.warning("Could not read Redis blacklist: %s", exc)
        return False
