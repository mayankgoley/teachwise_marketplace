from flask import Flask, render_template, redirect, url_for, request, jsonify
from config import Config
from database import db
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from flask_socketio import emit, join_room, leave_room
from flask_cors import CORS
from extensions import limiter, socketio
import stripe
import os
import json
from datetime import datetime

app = Flask(__name__)
app.config.from_object(Config)

# --- Sentry Error Tracking ---
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

_sentry_dsn = os.environ.get('SENTRY_DSN', '')
if _sentry_dsn and os.environ.get('FLASK_ENV') == 'production':
    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment='production',
        integrations=[
            FlaskIntegration(transaction_style='url'),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=0.05,
        before_send=lambda event, hint: (
            {**event, 'request': {**event.get('request', {}), 'cookies': {}}}
            if event.get('request', {}).get('cookies')
            else event
        ),
    )

# --- CORS (allow Next.js frontend in dev and production) ---
CORS(app, supports_credentials=True, origins=[
    "http://localhost:3000",
    "https://teachwiseedu.com",
])

from utils.logging_config import configure_logging
configure_logging(app)

db.init_app(app)
migrate = Migrate(app, db)
csrf = CSRFProtect(app)
stripe.api_key = app.config['STRIPE_SECRET_KEY']

# --- Rate Limiter (Redis-backed for multi-replica) ---
_rate_limit_storage = app.config.get('RATELIMIT_STORAGE_URI', 'memory://')
app.config['RATELIMIT_STORAGE_URI'] = _rate_limit_storage
app.config['RATELIMIT_DEFAULT'] = Config.RATELIMIT_DEFAULT
limiter.init_app(app)

# --- Server-Side Sessions (Redis-backed for multi-replica) ---
_session_type = app.config.get('SESSION_TYPE', 'filesystem')
if _session_type == 'redis':
    from flask_session import Session
    import redis as redis_lib
    _redis_url = app.config.get('REDIS_URL', '')
    if _redis_url:
        app.config['SESSION_REDIS'] = redis_lib.from_url(_redis_url)
    Session(app)

# --- Flask-SocketIO (Redis message queue for cross-replica broadcast) ---
_redis_url = app.config.get('REDIS_URL', '')
_socketio_kwargs = {
    'cors_allowed_origins': '*',
}
# Use gevent async mode only when running under gunicorn (SERVER_SOFTWARE is set)
# In dev mode (python app.py), use threading for compatibility
if os.environ.get('SERVER_SOFTWARE', '').startswith('gunicorn'):
    _socketio_kwargs['async_mode'] = 'gevent'
else:
    _socketio_kwargs['async_mode'] = 'threading'

# Enable Redis message queue if Redis is available (cross-replica broadcast)
if _redis_url:
    _socketio_kwargs['message_queue'] = _redis_url

socketio.init_app(app, **_socketio_kwargs)

# Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'student_bp.login_student'


def _get_cache_redis():
    try:
        from services.cache_service import _get_redis
        return _get_redis()
    except Exception:
        return None


@login_manager.user_loader
def load_user(uid):
    r = _get_cache_redis()
    if r:
        try:
            cached = r.get(f'tw:user:{uid}')
            if cached == '__exists__':
                return _load_user_from_db(uid)
            elif cached == '__none__':
                return None
        except Exception:
            pass

    user = _load_user_from_db(uid)

    if r:
        try:
            ttl = app.config.get('USER_CACHE_TTL', 300)
            if user:
                r.setex(f'tw:user:{uid}', ttl, '__exists__')
            else:
                r.setex(f'tw:user:{uid}', 60, '__none__')
        except Exception:
            pass

    return user


def _load_user_from_db(uid):
    if '_' not in uid:
        from models.student import Student
        return Student.query.get(int(uid))
    role, pk = uid.split('_', 1)
    pk = int(pk)
    if role == 'student':
        from models.student import Student
        return Student.query.get(pk)
    elif role == 'tutor':
        from models.tutor import Tutor
        return Tutor.query.get(pk)
    elif role == 'admin':
        from models.admin import Admin
        return Admin.query.get(pk)
    elif role == 'guardian':
        from models.guardian import Guardian
        return Guardian.query.get(pk)
    return None


def invalidate_user_cache(uid):
    r = _get_cache_redis()
    if r:
        try:
            r.delete(f'tw:user:{uid}')
        except Exception:
            pass


@login_manager.unauthorized_handler
def unauthorized():
    from flask import request as req, jsonify
    path = req.path
    # API endpoints return JSON 401 instead of redirecting
    if path.startswith('/api/'):
        return jsonify({
            "success": False,
            "error": {
                "code": 401,
                "message": "Authentication required.",
            },
        }), 401
    if path.startswith('/tutor'):
        return redirect(url_for('tutor_bp.login'))
    elif path.startswith('/admin'):
        return redirect(url_for('admin_bp.admin_login'))
    elif path.startswith('/guardian'):
        return redirect(url_for('guardian_bp.guardian_login'))
    return redirect(url_for('student_bp.login_student'))

from routes.student_routes import student_bp
from routes.tutor_routes import tutor_bp
from routes.admin_routes import admin_bp
from routes.guardian_routes import guardian_bp
from routes.document_routes import doc_bp
from routes.payment_routes import payment_bp
from routes.reschedule_routes import reschedule_bp
from routes.session_routes import session_bp
from routes.wallet_routes import wallet_bp
from routes.internal_api import internal_bp
app.register_blueprint(student_bp)
app.register_blueprint(tutor_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(guardian_bp)
app.register_blueprint(doc_bp)
app.register_blueprint(payment_bp)
app.register_blueprint(reschedule_bp)
app.register_blueprint(session_bp)
app.register_blueprint(wallet_bp)
app.register_blueprint(internal_bp)

from chatbot import register_chatbot
register_chatbot(app)

csrf.exempt(payment_bp)
csrf.exempt(internal_bp)

# In production these are routed to their own containers via nginx,
# but kept registered here so url_for() works in dev mode.
from routes.search_routes import search_bp
from routes.chat_routes import chat_bp
from routes.assignment_routes import assignment_bp
from routes.whiteboard_routes import whiteboard_bp
from routes.recording_routes import recording_bp
from routes.note_routes import note_bp
from routes.progress_routes import progress_bp
from routes.notification_routes import notification_bp
from routes.notification_center_routes import notif_center_bp

app.register_blueprint(search_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(assignment_bp)
app.register_blueprint(whiteboard_bp)
app.register_blueprint(recording_bp)
app.register_blueprint(note_bp)
app.register_blueprint(progress_bp)
app.register_blueprint(notification_bp)
app.register_blueprint(notif_center_bp)

from routes.geocoding_routes import geocoding_bp
app.register_blueprint(geocoding_bp)

from routes.api_auth import api_auth_bp
app.register_blueprint(api_auth_bp)
csrf.exempt(api_auth_bp)

from routes.api_dashboard import api_dashboard_bp
app.register_blueprint(api_dashboard_bp)
csrf.exempt(api_dashboard_bp)

from routes.api_search import api_search_bp
app.register_blueprint(api_search_bp)
csrf.exempt(api_search_bp)

from routes.api_tutor_public import api_tutor_public_bp
app.register_blueprint(api_tutor_public_bp)
csrf.exempt(api_tutor_public_bp)

from routes.api_student_features import api_student_features_bp
app.register_blueprint(api_student_features_bp)
csrf.exempt(api_student_features_bp)

from routes.api_tutor_features import api_tutor_features_bp
app.register_blueprint(api_tutor_features_bp)
csrf.exempt(api_tutor_features_bp)

from routes.api_assignments import api_assignments_bp
app.register_blueprint(api_assignments_bp)
csrf.exempt(api_assignments_bp)

from routes.api_progress import api_progress_bp
app.register_blueprint(api_progress_bp)
csrf.exempt(api_progress_bp)

from routes.api_chat import api_chat_bp
app.register_blueprint(api_chat_bp)
csrf.exempt(api_chat_bp)

from routes.api_session import api_session_bp
app.register_blueprint(api_session_bp)
csrf.exempt(api_session_bp)

from routes.api_tutor_profile import api_tutor_profile_bp
app.register_blueprint(api_tutor_profile_bp)
csrf.exempt(api_tutor_profile_bp)

from routes.api_tutor_documents import api_tutor_documents_bp
app.register_blueprint(api_tutor_documents_bp)
csrf.exempt(api_tutor_documents_bp)

from routes.api_admin import api_admin_bp
app.register_blueprint(api_admin_bp)
csrf.exempt(api_admin_bp)

from routes.api_guardian_features import api_guardian_features_bp
app.register_blueprint(api_guardian_features_bp)
csrf.exempt(api_guardian_features_bp)

from routes.api_verify import api_verify_bp
app.register_blueprint(api_verify_bp)
csrf.exempt(api_verify_bp)

from routes.api_reschedule import api_reschedule_bp
app.register_blueprint(api_reschedule_bp)
csrf.exempt(api_reschedule_bp)

from routes.api_recordings import api_recordings_bp
app.register_blueprint(api_recordings_bp)
csrf.exempt(api_recordings_bp)

from models import *

from utils.timezone_utils import format_time_local, utc_to_local, COMMON_TIMEZONES


@app.template_filter('photo_url')
def photo_url_filter(photo_value):
    if not photo_value:
        return None
    if photo_value.startswith('http') or photo_value.startswith('/'):
        return photo_value
    return f'/static/uploads/photos/{photo_value}'


@app.template_filter('local_time')
def local_time_filter(time_obj, date_obj=None, tz_string='UTC'):
    return format_time_local(time_obj, date_obj, tz_string)


@app.template_filter('local_datetime')
def local_datetime_filter(dt, tz_string='UTC'):
    converted = utc_to_local(dt, tz_string)
    if converted:
        return converted.strftime("%b %d, %Y at %I:%M %p %Z")
    return str(dt)


@app.template_filter('meeting_address_display')
def meeting_address_display_filter(booking, viewer_is_tutor=False):
    if not booking:
        return 'Location not specified'
    if booking.meeting_location_type == 'home':
        if booking.status in ('Booked', 'Confirmed', 'Completed') and viewer_is_tutor:
            from services.encryption_service import decrypt_field
            if booking.meeting_address_encrypted:
                decrypted = decrypt_field(
                    booking.meeting_address_encrypted.decode()
                    if isinstance(booking.meeting_address_encrypted, bytes)
                    else booking.meeting_address_encrypted
                )
                return decrypted or 'Address unavailable'
        return f"Home in {booking.meeting_location_label or 'undisclosed location'}"
    return booking.meeting_address or 'Location not specified'


@app.context_processor
def inject_user_timezone():
    from flask_login import current_user as cu
    tz = 'UTC'
    if cu.is_authenticated and hasattr(cu, 'timezone') and cu.timezone:
        tz = cu.timezone
    return {
        'user_timezone': tz,
        'timezone_choices': COMMON_TIMEZONES,
        'app_version': app.config.get('VERSION', '1.0.0'),
    }

@app.after_request
def add_security_headers(response):
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://js.stripe.com https://meet.jit.si; "
        "worker-src 'self' blob:; "
        "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
        "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.cloudflare.com; "
        "connect-src 'self' ws: wss: https://nominatim.openstreetmap.org https://api.stripe.com; "
        "frame-src 'self' https://js.stripe.com https://meet.jit.si; "
    )
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

from flask import Blueprint
main = Blueprint('main', __name__)

@main.route('/')
def index():
    from services.recommendation_service import get_recommended_tutors
    from flask_login import current_user

    student_lat = None
    student_lng = None
    if current_user and hasattr(current_user, 'latitude'):
        student_lat = getattr(current_user, 'latitude', None)
        student_lng = getattr(current_user, 'longitude', None)

    tutors = get_recommended_tutors(
        student_lat=student_lat,
        student_lng=student_lng,
        limit=9
    )
    from utils.categories import load_categories
    return render_template('index.html', tutors=tutors, categories=load_categories())

app.register_blueprint(main)

from flask import jsonify


# error pages
@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404


@app.errorhandler(500)
def internal_server_error(e):
    if request.path.startswith('/api/'):
        return jsonify({"success": False, "error": {"message": "Internal server error", "code": 500}}), 500
    try:
        return render_template('500.html'), 500
    except Exception:
        return jsonify({"success": False, "error": {"message": "Internal server error", "code": 500}}), 500


# sidebar badge counts
@app.context_processor
def inject_sidebar_badges():
    from flask_login import current_user as cu
    badges = {}
    if cu.is_authenticated:
        try:
            if cu.user_type == 'student':
                from models.in_app_notification import InAppNotification
                badges['sidebar_unread_notifs'] = InAppNotification.query.filter_by(
                    user_id=cu.id, user_role='student', is_read=False
                ).count()
            elif cu.user_type == 'tutor':
                from models.in_app_notification import InAppNotification
                badges['sidebar_unread_notifs'] = InAppNotification.query.filter_by(
                    user_id=cu.id, user_role='tutor', is_read=False
                ).count()
            elif cu.user_type == 'guardian':
                from models.guardian_message import GuardianMessage
                badges['sidebar_unread_msgs'] = GuardianMessage.query.filter_by(
                    guardian_id=cu.id, is_read=False
                ).filter(GuardianMessage.sender_type != 'guardian').count()
        except Exception:
            pass
    return badges


@app.route('/health')
def health_check():
    checks = {}
    healthy = True

    try:
        db.session.execute(db.text('SELECT 1'))
        checks['database'] = 'ok'
    except Exception as e:
        checks['database'] = f'error: {str(e)}'
        healthy = False

    try:
        from services.cache_service import _get_redis
        r = _get_redis()
        if r:
            r.ping()
            checks['redis'] = 'ok'
        else:
            checks['redis'] = 'not configured'
    except Exception:
        checks['redis'] = 'unavailable'

    return jsonify({
        'status': 'healthy' if healthy else 'degraded',
        'timestamp': datetime.utcnow().isoformat(),
        'checks': checks,
    }), 200 if healthy else 503

_redis_url_for_events = app.config.get('REDIS_URL', '')
if _redis_url_for_events:
    from shared.event_bus import init_event_bus
    init_event_bus(_redis_url_for_events, service_name='core-service')

from shared.service_client import ServiceClient
service_client = ServiceClient(app)

_should_run_scheduler = (
    os.environ.get('RUN_SCHEDULER', 'true').lower() == 'true'
    and (not app.debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true')
)
if _should_run_scheduler:
    from services.scheduler_service import init_scheduler
    init_scheduler(app)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    port = int(os.environ.get('PORT', 5001))
    socketio.run(app, debug=True, port=port, allow_unsafe_werkzeug=True)
