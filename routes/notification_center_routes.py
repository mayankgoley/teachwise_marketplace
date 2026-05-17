from flask import (Blueprint, render_template, request, jsonify)
from flask_login import login_required, current_user
from database import db
from models.in_app_notification import InAppNotification
from datetime import datetime

notif_center_bp = Blueprint('notif_center_bp', __name__)


@notif_center_bp.route('/notifications')
@login_required
def notification_center():
    page = request.args.get('page', 1, type=int)
    filter_type = request.args.get('type', 'all')

    query = InAppNotification.query.filter_by(
        user_id=current_user.id,
        user_type=current_user.user_type
    ).order_by(InAppNotification.created_at.desc())

    if filter_type != 'all':
        query = query.filter_by(type=filter_type)

    pagination = query.paginate(page=page, per_page=20, error_out=False)
    notifications = pagination.items

    # Count unread
    unread_count = InAppNotification.query.filter_by(
        user_id=current_user.id,
        user_type=current_user.user_type,
        is_read=False
    ).count()

    # collapse notifications that share a group_key
    grouped = {}
    ungrouped = []
    for n in notifications:
        if n.group_key:
            if n.group_key not in grouped:
                grouped[n.group_key] = n
            else:
                existing = grouped[n.group_key]
                existing.count = (existing.count or 1) + 1
        else:
            ungrouped.append(n)
    display_notifications = list(grouped.values()) + ungrouped
    display_notifications.sort(key=lambda n: n.created_at, reverse=True)

    # per-user notification prefs (default if the attr isn't set)
    notification_sound = getattr(current_user, 'notification_sound', True)
    email_digest = getattr(current_user, 'email_digest_frequency', 'instant')
    reminder_times = getattr(current_user, 'reminder_times', {}) or {}

    return render_template('notification_center.html',
                           notifications=display_notifications,
                           pagination=pagination,
                           filter_type=filter_type,
                           unread_count=unread_count,
                           notification_sound=notification_sound,
                           email_digest=email_digest,
                           reminder_times=reminder_times)


@notif_center_bp.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
@login_required
def mark_read(notif_id):
    notif = InAppNotification.query.get_or_404(notif_id)
    if notif.user_id != current_user.id or notif.user_type != current_user.user_type:
        return jsonify(error='Forbidden'), 403

    notif.is_read = True
    notif.read_at = datetime.utcnow()
    db.session.commit()
    return jsonify(success=True)


# mark all read
@notif_center_bp.route('/api/notifications/read-all', methods=['POST'])
@login_required
def mark_all_read():
    InAppNotification.query.filter_by(
        user_id=current_user.id,
        user_type=current_user.user_type,
        is_read=False
    ).update({'is_read': True, 'read_at': datetime.utcnow()})
    db.session.commit()
    return jsonify(success=True)


@notif_center_bp.route('/api/notifications/unread-count')
@login_required
def unread_count():
    count = InAppNotification.query.filter_by(
        user_id=current_user.id,
        user_type=current_user.user_type,
        is_read=False
    ).count()
    return jsonify(count=count)


@notif_center_bp.route('/api/notifications/sound', methods=['POST'])
@login_required
def toggle_sound():
    data = request.get_json(silent=True) or {}
    enabled = data.get('enabled', True)

    if current_user.user_type == 'student':
        from models.student import Student
        user = Student.query.get(current_user.id)
    elif current_user.user_type == 'tutor':
        from models.tutor import Tutor
        user = Tutor.query.get(current_user.id)
    else:
        return jsonify(error='Not supported'), 400

    if user:
        user.notification_sound = bool(enabled)
        db.session.commit()
    return jsonify(success=True, enabled=bool(enabled))


# email digest preferences
@notif_center_bp.route('/api/notifications/email-digest', methods=['POST'])
@login_required
def set_email_digest():
    data = request.get_json(silent=True) or {}
    freq = data.get('frequency', 'instant')
    if freq not in ('instant', 'daily', 'weekly', 'none'):
        return jsonify(error='Invalid frequency'), 400

    if current_user.user_type == 'student':
        from models.student import Student
        user = Student.query.get(current_user.id)
    elif current_user.user_type == 'tutor':
        from models.tutor import Tutor
        user = Tutor.query.get(current_user.id)
    else:
        return jsonify(error='Not supported'), 400

    if user:
        user.email_digest_frequency = freq
        db.session.commit()
    return jsonify(success=True, frequency=freq)


@notif_center_bp.route('/api/notifications/reminder-timing', methods=['POST'])
@login_required
def set_reminder_timing():
    data = request.get_json(silent=True) or {}
    times = data.get('times', {})
    # Validate: must be dict with valid keys
    valid_keys = {'24h', '12h', '1h', '30m'}
    cleaned = {k: bool(v) for k, v in times.items() if k in valid_keys}

    if current_user.user_type == 'student':
        from models.student import Student
        user = Student.query.get(current_user.id)
    elif current_user.user_type == 'tutor':
        from models.tutor import Tutor
        user = Tutor.query.get(current_user.id)
    else:
        return jsonify(error='Not supported'), 400

    if user:
        user.reminder_times = cleaned
        db.session.commit()
    return jsonify(success=True, times=cleaned)


# web push subscription
@notif_center_bp.route('/api/notifications/push-subscribe', methods=['POST'])
@login_required
def push_subscribe():
    data = request.get_json(silent=True) or {}
    subscription = data.get('subscription')
    if not subscription:
        return jsonify(error='Subscription data required'), 400

    if current_user.user_type == 'student':
        from models.student import Student
        user = Student.query.get(current_user.id)
    elif current_user.user_type == 'tutor':
        from models.tutor import Tutor
        user = Tutor.query.get(current_user.id)
    else:
        return jsonify(error='Not supported'), 400

    if user:
        user.push_subscription = subscription
        db.session.commit()
    return jsonify(success=True)


@notif_center_bp.route('/api/notifications/push-unsubscribe', methods=['POST'])
@login_required
def push_unsubscribe():
    if current_user.user_type == 'student':
        from models.student import Student
        user = Student.query.get(current_user.id)
    elif current_user.user_type == 'tutor':
        from models.tutor import Tutor
        user = Tutor.query.get(current_user.id)
    else:
        return jsonify(error='Not supported'), 400

    if user:
        user.push_subscription = None
        db.session.commit()
    return jsonify(success=True)
