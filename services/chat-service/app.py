from flask import Flask, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from config import Config
from database import db
from datetime import datetime
import os
import logging

app = Flask(__name__)
app.config.from_object(Config)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [chat-service] %(levelname)s %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

db.init_app(app)

redis_url = app.config.get('REDIS_URL', '')
socketio_kwargs = {'cors_allowed_origins': '*'}

if os.environ.get('SERVER_SOFTWARE', '').startswith('gunicorn'):
    socketio_kwargs['async_mode'] = 'gevent'
else:
    socketio_kwargs['async_mode'] = 'threading'

if redis_url:
    socketio_kwargs['message_queue'] = redis_url

socketio = SocketIO(app, **socketio_kwargs)

from routes.chat_routes import chat_bp
app.register_blueprint(chat_bp)

@socketio.on('join_conversation')
def handle_join(data):
    room = f"conv_{data.get('conversation_id')}"
    join_room(room)

@socketio.on('leave_conversation')
def handle_leave(data):
    room = f"conv_{data.get('conversation_id')}"
    leave_room(room)

@socketio.on('typing')
def handle_typing(data):
    room = f"conv_{data.get('conversation_id')}"
    emit('user_typing', {
        'user_type': data.get('user_type'),
        'user_name': data.get('user_name')
    }, room=room, include_self=False)

if redis_url:
    from shared.event_bus import init_event_bus
    init_event_bus(redis_url, service_name='chat-service')

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
        'service': 'chat-service',
        'status': 'healthy' if healthy else 'degraded',
        'timestamp': datetime.utcnow().isoformat(),
        'checks': checks,
    }), 200 if healthy else 503


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5003))
    socketio.run(app, debug=True, port=port, allow_unsafe_werkzeug=True)
