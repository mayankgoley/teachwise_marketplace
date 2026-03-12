import json
import redis
from flask import current_app

_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is None:
        url = current_app.config.get('REDIS_URL', '')
        if not url:
            return None
        try:
            _redis_client = redis.from_url(
                url, decode_responses=True,
                socket_timeout=3, socket_connect_timeout=3
            )
            _redis_client.ping()
        except Exception as e:
            current_app.logger.warning(f'Redis connection failed: {e}')
            _redis_client = None
    return _redis_client


def cache_get(key):
    r = _get_redis()
    if not r:
        return None
    try:
        val = r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


def cache_set(key, value, ttl=None):
    r = _get_redis()
    if not r:
        return
    try:
        ttl = ttl or current_app.config.get('CACHE_TTL', 900)
        r.setex(key, ttl, json.dumps(value))
    except Exception:
        pass


def cache_delete(key):
    r = _get_redis()
    if not r:
        return
    try:
        r.delete(key)
    except Exception:
        pass


def cache_delete_pattern(pattern):
    r = _get_redis()
    if not r:
        return
    try:
        cursor = 0
        while True:
            cursor, keys = r.scan(cursor, match=pattern, count=100)
            if keys:
                r.delete(*keys)
            if cursor == 0:
                break
    except Exception:
        pass
