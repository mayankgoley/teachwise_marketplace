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

    return render_template('notification_center.html',
                           notifications=notifications,
                           pagination=pagination,
                           filter_type=filter_type,
                           unread_count=unread_count)


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
