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
    format='%(asctime)s [search-service] %(levelname)s %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

db.init_app(app)

from routes.search_routes import search_bp
app.register_blueprint(search_bp)

redis_url = app.config.get('REDIS_URL', '')
if redis_url:
    from shared.event_bus import init_event_bus, subscribe_events, start_event_listener
    from services.cache_service import cache_delete_pattern

    init_event_bus(redis_url, service_name='search-service')

    def _invalidate_search_cache(event_data):
        logger.info(f'Cache invalidation triggered: {event_data}')
        cache_delete_pattern('search:*')
        cache_delete_pattern('rec:*')

    subscribe_events('booking.created', _invalidate_search_cache)
    subscribe_events('booking.cancelled', _invalidate_search_cache)
    subscribe_events('tutor.verified', _invalidate_search_cache)
    subscribe_events('review.created', _invalidate_search_cache)

    start_event_listener(app)

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
        'service': 'search-service',
        'status': 'healthy' if healthy else 'degraded',
        'timestamp': datetime.utcnow().isoformat(),
        'checks': checks,
    }), 200 if healthy else 503


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5002))
    app.run(debug=True, port=port)
