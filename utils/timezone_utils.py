import pytz
from datetime import datetime, date, time


COMMON_TIMEZONES = [
    ("America/New_York", "Eastern Time (ET)"),
    ("America/Chicago", "Central Time (CT)"),
    ("America/Denver", "Mountain Time (MT)"),
    ("America/Los_Angeles", "Pacific Time (PT)"),
    ("America/Anchorage", "Alaska Time (AKT)"),
    ("Pacific/Honolulu", "Hawaii Time (HT)"),
    ("America/Phoenix", "Arizona (no DST)"),
    ("America/Toronto", "Eastern Canada"),
    ("America/Vancouver", "Pacific Canada"),
    ("Europe/London", "London (GMT/BST)"),
    ("Europe/Paris", "Central European (CET)"),
    ("Europe/Berlin", "Berlin (CET)"),
    ("Asia/Tokyo", "Japan (JST)"),
    ("Asia/Shanghai", "China (CST)"),
    ("Asia/Kolkata", "India (IST)"),
    ("Asia/Dubai", "Gulf (GST)"),
    ("Australia/Sydney", "Sydney (AEST)"),
    ("Pacific/Auckland", "New Zealand (NZST)"),
    ("UTC", "UTC"),
]


def utc_to_local(dt_utc, tz_string):
    """Convert naive UTC datetime to user's local timezone."""
    if dt_utc is None or tz_string is None:
        return dt_utc
    try:
        utc_tz = pytz.UTC
        local_tz = pytz.timezone(tz_string)
        if dt_utc.tzinfo is None:
            dt_utc = utc_tz.localize(dt_utc)
        return dt_utc.astimezone(local_tz)
    except Exception:
        return dt_utc


def combine_and_localize(date_obj, time_obj, tz_string):
    """Combine date + time, treat as UTC, convert to local."""
    if date_obj is None or time_obj is None:
        return None
    dt = datetime.combine(date_obj, time_obj)
    return utc_to_local(dt, tz_string)


def local_to_utc(dt_local, tz_string):
    """Convert local datetime to UTC for storage."""
    try:
        local_tz = pytz.timezone(tz_string)
        if dt_local.tzinfo is None:
            dt_local = local_tz.localize(dt_local)
        return dt_local.astimezone(pytz.UTC)
    except Exception:
        return dt_local


def format_time_local(time_obj, date_obj, tz_string, fmt="%I:%M %p %Z"):
    """Format time in user's local timezone with TZ abbreviation."""
    dt = combine_and_localize(date_obj, time_obj, tz_string)
    if dt is None:
        return str(time_obj) if time_obj else ""
    return dt.strftime(fmt)


def get_tz_abbreviation(tz_string, dt=None):
    """Get timezone abbreviation like EST, PST."""
    try:
        tz = pytz.timezone(tz_string)
        if dt is None:
            dt = datetime.now(tz)
        return dt.strftime("%Z")
    except Exception:
        return tz_string
