"""Slot holds via Redis SETNX, with an in-memory fallback for local dev.

The in-memory path is single-process only. Don't rely on it under gunicorn.
"""
import json
import threading
import time
from datetime import datetime
from typing import Optional

HOLD_TTL_SECONDS = 480  # 8 minutes

_LOCK = threading.Lock()
_MEM_HOLDS: dict[str, tuple[str, float]] = {}  # key -> (json_data, expires_at_ts)


def _hold_key(slot_id: int) -> str:
    return f"slot_hold:{slot_id}"


def _get_redis():
    try:
        import redis
        r = redis.Redis(socket_connect_timeout=0.5)
        r.ping()
        return r
    except Exception:
        return None


# dev fallback, process-local only

def _mem_get(key: str) -> Optional[str]:
    with _LOCK:
        entry = _MEM_HOLDS.get(key)
        if entry is None:
            return None
        data, expires_at = entry
        if time.time() > expires_at:
            del _MEM_HOLDS[key]
            return None
        return data


def _mem_setnx(key: str, value: str, ttl: int) -> bool:
    with _LOCK:
        entry = _MEM_HOLDS.get(key)
        if entry is not None:
            _, expires_at = entry
            if time.time() <= expires_at:
                return False
        _MEM_HOLDS[key] = (value, time.time() + ttl)
        return True


def _mem_delete(key: str):
    with _LOCK:
        _MEM_HOLDS.pop(key, None)


def _mem_ttl(key: str) -> int:
    with _LOCK:
        entry = _MEM_HOLDS.get(key)
        if entry is None:
            return -2
        _, expires_at = entry
        remaining = int(expires_at - time.time())
        return max(remaining, 0)


def _mem_expire(key: str, ttl: int):
    with _LOCK:
        entry = _MEM_HOLDS.get(key)
        if entry is not None:
            data, _ = entry
            _MEM_HOLDS[key] = (data, time.time() + ttl)


def acquire_hold(slot_id: int, student_id: int, max_students: int = 1) -> dict:
    """Try to hold a slot. Returns {success, hold_key, expires_in, error}."""
    key = _hold_key(slot_id)
    hold_data = json.dumps({
        'student_id': student_id,
        'slot_id': slot_id,
        'held_at': datetime.utcnow().isoformat(),
    })

    r = _get_redis()

    if max_students == 1:
        if r:
            acquired = r.set(key, hold_data, nx=True, ex=HOLD_TTL_SECONDS)
        else:
            acquired = _mem_setnx(key, hold_data, HOLD_TTL_SECONDS)

        if acquired:
            return {
                'success': True,
                'hold_key': key,
                'expires_in': HOLD_TTL_SECONDS,
                'error': None,
            }

        existing = r.get(key) if r else _mem_get(key)
        if existing:
            try:
                existing_str = existing.decode() if isinstance(existing, bytes) else existing
                existing_data = json.loads(existing_str)
                if existing_data.get('student_id') == student_id:
                    if r:
                        r.expire(key, HOLD_TTL_SECONDS)
                    else:
                        _mem_expire(key, HOLD_TTL_SECONDS)
                    return {
                        'success': True,
                        'hold_key': key,
                        'expires_in': HOLD_TTL_SECONDS,
                        'error': None,
                    }
            except Exception:
                pass

        ttl = (r.ttl(key) if r else _mem_ttl(key))
        return {
            'success': False,
            'hold_key': None,
            'expires_in': None,
            'error': f'This slot is being booked by another student. Try again in {max(ttl, 30)} seconds.',
        }

    else:
        # group slots: per-student keys, count active ones to enforce cap
        # FIXME: this races between SET and KEYS scan when N students hit at once
        student_key = f"{key}:{student_id}"
        if r:
            acquired = r.set(student_key, hold_data, nx=True, ex=HOLD_TTL_SECONDS)
            if acquired:
                count = len(r.keys(f"{key}:*"))
            else:
                count = max_students
        else:
            acquired = _mem_setnx(student_key, hold_data, HOLD_TTL_SECONDS)
            if acquired:
                with _LOCK:
                    count = sum(
                        1 for k, (_, exp) in _MEM_HOLDS.items()
                        if k.startswith(f"{key}:") and time.time() <= exp
                    )
            else:
                count = max_students

        if acquired and count <= max_students:
            return {
                'success': True,
                'hold_key': student_key,
                'expires_in': HOLD_TTL_SECONDS,
                'error': None,
            }
        elif acquired and count > max_students:
            if r:
                r.delete(student_key)
            else:
                _mem_delete(student_key)
            return {
                'success': False,
                'hold_key': None,
                'expires_in': None,
                'error': 'This group session is full. All spots are being booked.',
            }
        else:
            return {
                'success': False,
                'hold_key': None,
                'expires_in': None,
                'error': 'This slot is being booked by another student.',
            }


def release_hold(slot_id: int, student_id: int = None) -> bool:
    """Drop a hold once we're done with it (book confirmed, payment failed, etc)."""
    key = _hold_key(slot_id)
    r = _get_redis()

    try:
        existing = r.get(key) if r else _mem_get(key)
        if existing:
            try:
                existing_str = existing.decode() if isinstance(existing, bytes) else existing
                data = json.loads(existing_str)
                if student_id is None or data.get('student_id') == student_id:
                    if r:
                        r.delete(key)
                    else:
                        _mem_delete(key)
                    return True
            except Exception:
                if r:
                    r.delete(key)
                else:
                    _mem_delete(key)
                return True
        student_key = f"{key}:{student_id}"
        if r:
            r.delete(student_key)
        else:
            _mem_delete(student_key)
        return True
    except Exception:
        return False


def get_hold_status(slot_id: int) -> dict:
    key = _hold_key(slot_id)
    r = _get_redis()

    try:
        existing = r.get(key) if r else _mem_get(key)
        ttl = (r.ttl(key) if r else _mem_ttl(key))
        if existing:
            try:
                existing_str = existing.decode() if isinstance(existing, bytes) else existing
                data = json.loads(existing_str)
                return {
                    'held': True,
                    'student_id': data.get('student_id'),
                    'expires_in': max(ttl, 0),
                    'held_at': data.get('held_at'),
                }
            except Exception:
                pass
        return {'held': False, 'student_id': None, 'expires_in': 0}
    except Exception:
        return {'held': False, 'student_id': None, 'expires_in': 0}
