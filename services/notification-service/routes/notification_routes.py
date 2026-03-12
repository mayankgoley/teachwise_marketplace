from flask import Blueprint, request, jsonify, render_template
from database import db
from models.in_app_notification import InAppNotification
from shared.jwt_auth import get_jwt_from_request, decode_jwt_token
from datetime import datetime

notification_bp = Blueprint('notification_bp', __name__)


def _get_user_info():
    token = get_jwt_from_request()
    if not token:
        return None, None, None
    try:
        payload = decode_jwt_token(token)
        uid = payload.get('uid', '')
        role = payload.get('role', '')
        name = payload.get('name', '')
        if '_' in uid:
            user_id = int(uid.split('_', 1)[1])
        else:
            user_id = int(uid)
        return role, user_id, name
    except Exception:
        return None, None, None


@notification_bp.route('/api/notifications')
def get_notifications():
    role, user_id, _ = _get_user_info()
    if not role:
        return jsonify([])

    notifications = InAppNotification.query.filter_by(
        user_id=user_id, user_type=role
    ).order_by(InAppNotification.created_at.desc()).limit(20).all()

    return jsonify([n.to_dict() for n in notifications])


@notification_bp.route('/notifications')
def notification_center():
    role, user_id, _ = _get_user_info()
    if not role:
        return jsonify(error='Authentication required'), 401

    page = request.args.get('page', 1, type=int)
    filter_type = request.args.get('type', 'all')

    query = InAppNotification.query.filter_by(
        user_id=user_id, user_type=role
    ).order_by(InAppNotification.created_at.desc())

    if filter_type != 'all':
        query = query.filter_by(type=filter_type)

    pagination = query.paginate(page=page, per_page=20, error_out=False)

    unread_count = InAppNotification.query.filter_by(
        user_id=user_id, user_type=role, is_read=False
    ).count()

    return render_template('notification_center.html',
                           notifications=pagination.items,
                           pagination=pagination,
                           filter_type=filter_type,
                           unread_count=unread_count)


@notification_bp.route('/api/notifications/<int:notif_id>/read', methods=['POST'])
def mark_read(notif_id):
    role, user_id, _ = _get_user_info()
    if not role:
        return jsonify(error='Authentication required'), 401

    notif = InAppNotification.query.get_or_404(notif_id)
    if notif.user_id != user_id or notif.user_type != role:
        return jsonify(error='Forbidden'), 403

    notif.is_read = True
    notif.read_at = datetime.utcnow()
    db.session.commit()
    return jsonify(success=True)


@notification_bp.route('/api/notifications/read-all', methods=['POST'])
def mark_all_read():
    role, user_id, _ = _get_user_info()
    if not role:
        return jsonify(error='Authentication required'), 401

    InAppNotification.query.filter_by(
        user_id=user_id, user_type=role, is_read=False
    ).update({'is_read': True, 'read_at': datetime.utcnow()})
    db.session.commit()
    return jsonify(success=True)


@notification_bp.route('/api/notifications/unread-count')
def unread_count():
    role, user_id, _ = _get_user_info()
    if not role:
        return jsonify(count=0)

    count = InAppNotification.query.filter_by(
        user_id=user_id, user_type=role, is_read=False
    ).count()
    return jsonify(count=count)
