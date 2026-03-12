from flask import Blueprint, jsonify
from flask_login import current_user
from services.notification_service import (
    get_student_notifications,
    get_tutor_notifications,
    get_admin_notifications
)
from datetime import datetime

notification_bp = Blueprint('notification_bp', __name__)


@notification_bp.route('/api/notifications')
def get_notifications():
    """Return JSON array of notifications for the current user."""
    # Determine user type
    if not current_user.is_authenticated:
        return jsonify([])

    if current_user.user_type == 'admin':
        notifications = get_admin_notifications()
    elif current_user.user_type == 'tutor':
        notifications = get_tutor_notifications(current_user.id)
    elif current_user.user_type == 'student':
        notifications = get_student_notifications(current_user)
    else:
        return jsonify([])

    # Sort by timestamp descending (newest first)
    notifications.sort(key=lambda n: n['timestamp'], reverse=True)
    return jsonify(notifications)
