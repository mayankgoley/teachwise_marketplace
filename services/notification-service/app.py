import os
from flask import Flask, jsonify
from config import Config
from database import db
from datetime import datetime
import logging

app = Flask(__name__)
app.config.from_object(Config)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [notification-service] %(levelname)s %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

db.init_app(app)

from routes.notification_routes import notification_bp
app.register_blueprint(notification_bp)

redis_url = app.config.get('REDIS_URL', '')
if redis_url:
    from shared.event_bus import init_event_bus, subscribe_events, start_event_listener
    from services.notification_builder import (
        handle_booking_created,
        handle_booking_cancelled,
        handle_payment_completed,
        handle_message_sent,
        handle_assignment_submitted,
        handle_assignment_graded,
        handle_goal_completed,
        handle_tutor_verified,
        handle_review_created,
    )

    init_event_bus(redis_url, service_name='notification-service')

    subscribe_events('booking.created', handle_booking_created)
    subscribe_events('booking.cancelled', handle_booking_cancelled)
    subscribe_events('payment.completed', handle_payment_completed)
    subscribe_events('message.sent', handle_message_sent)
    subscribe_events('assignment.submitted', handle_assignment_submitted)
    subscribe_events('assignment.graded', handle_assignment_graded)
    subscribe_events('goal.completed', handle_goal_completed)
    subscribe_events('tutor.verified', handle_tutor_verified)
    subscribe_events('review.created', handle_review_created)

    start_event_listener(app)

from shared.service_client import ServiceClient
service_client = ServiceClient(app)

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

    return jsonify({
        'service': 'notification-service',
        'status': 'healthy' if healthy else 'degraded',
        'timestamp': datetime.utcnow().isoformat(),
        'checks': checks,
    }), 200 if healthy else 503


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5005))
    app.run(debug=True, port=port)
