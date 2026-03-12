from functools import wraps
from flask import flash, redirect, url_for
from flask_login import current_user, login_required
from datetime import datetime, timedelta


def role_required(*roles):
    def decorator(f):
        @wraps(f)
        @login_required
        def wrapped(*args, **kwargs):
            if current_user.user_type not in roles:
                flash('Access denied.', 'danger')
                return redirect(url_for('main.index'))
            return f(*args, **kwargs)
        return wrapped
    return decorator


MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


def is_account_locked(user):
    if not hasattr(user, 'locked_until') or not user.locked_until:
        return False
    if datetime.utcnow() >= user.locked_until:
        # Lock expired — reset
        user.failed_login_attempts = 0
        user.locked_until = None
        from database import db
        db.session.commit()
        return False
    return True


def increment_failed_login(user):
    if not hasattr(user, 'failed_login_attempts'):
        return
    user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
    if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
        user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
    from database import db
    db.session.commit()


def reset_failed_login(user):
    if not hasattr(user, 'failed_login_attempts'):
        return
    if user.failed_login_attempts and user.failed_login_attempts > 0:
        user.failed_login_attempts = 0
        user.locked_until = None
        from database import db
        db.session.commit()
