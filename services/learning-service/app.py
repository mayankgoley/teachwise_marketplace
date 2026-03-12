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
    format='%(asctime)s [learning-service] %(levelname)s %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

db.init_app(app)

from routes.learning_routes import learning_bp
app.register_blueprint(learning_bp)

redis_url = app.config.get('REDIS_URL', '')
if redis_url:
    from shared.event_bus import init_event_bus, subscribe_events, start_event_listener

    init_event_bus(redis_url, service_name='learning-service')

    def _handle_session_started(event_data):
        logger.info(f'Session started event: {event_data}')

    def _handle_session_ended(event_data):
        logger.info(f'Session ended event: {event_data}')

    subscribe_events('session.started', _handle_session_started)
    subscribe_events('session.ended', _handle_session_ended)

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
        'service': 'learning-service',
        'status': 'healthy' if healthy else 'degraded',
        'timestamp': datetime.utcnow().isoformat(),
        'checks': checks,
    }), 200 if healthy else 503


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5004))
    app.run(debug=True, port=port)
