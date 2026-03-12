import json
import redis
import threading
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# Module-level state
_redis_url = None
_service_name = None
_subscriptions = {}  # channel -> [handler_functions]
_listener_thread = None


def init_event_bus(redis_url, service_name='unknown'):
    global _redis_url, _service_name
    _redis_url = redis_url
    _service_name = service_name


def _get_publisher_redis():
    if not _redis_url:
        return None
    try:
        return redis.from_url(
            _redis_url,
            decode_responses=True,
            socket_timeout=3,
            socket_connect_timeout=3
        )
    except Exception as e:
        logger.warning(f'Event bus: Redis connection failed: {e}')
        return None


def publish_event(event_type, data, channel=None):
    r = _get_publisher_redis()
    if not r:
        logger.warning(f'Event bus: Cannot publish {event_type} — no Redis')
        return False

    channel = channel or 'tw:events'
    envelope = {
        'event': event_type,
        'data': data,
        'timestamp': datetime.utcnow().isoformat(),
        'source': _service_name or 'unknown',
    }

    try:
        r.publish(channel, json.dumps(envelope))
        logger.info(f'Event published: {event_type}')
        return True
    except Exception as e:
        logger.error(f'Event bus: Failed to publish {event_type}: {e}')
        return False


def subscribe_events(event_type, handler):
    if event_type not in _subscriptions:
        _subscriptions[event_type] = []
    _subscriptions[event_type].append(handler)
    logger.info(f'Event subscription registered: {event_type}')


def _listener_loop(app, channel):
    while True:
        try:
            r = redis.from_url(
                _redis_url,
                decode_responses=True,
                socket_timeout=0,  # Block forever on subscribe
                socket_connect_timeout=5
            )
            pubsub = r.pubsub()
            pubsub.subscribe(channel)
            logger.info(f'Event listener connected to channel: {channel}')

            for message in pubsub.listen():
                if message['type'] != 'message':
                    continue

                try:
                    envelope = json.loads(message['data'])
                    event_type = envelope.get('event')
                    event_data = envelope.get('data', {})

                    if envelope.get('source') == _service_name:
                        continue

                    handlers = _subscriptions.get(event_type, [])
                    if not handlers:
                        continue

                    logger.info(
                        f'Event received: {event_type} '
                        f'from {envelope.get("source")}'
                    )

                    with app.app_context():
                        for handler in handlers:
                            try:
                                handler(event_data)
                            except Exception as e:
                                logger.error(
                                    f'Event handler error for {event_type}: {e}',
                                    exc_info=True
                                )

                except json.JSONDecodeError:
                    logger.warning('Event bus: Invalid JSON message received')
                except Exception as e:
                    logger.error(f'Event processing error: {e}', exc_info=True)

        except redis.ConnectionError as e:
            logger.warning(f'Event listener disconnected: {e}. Reconnecting in 5s...')
            import time
            time.sleep(5)
        except Exception as e:
            logger.error(f'Event listener error: {e}. Reconnecting in 5s...',
                        exc_info=True)
            import time
            time.sleep(5)


def start_event_listener(app, channel='tw:events'):
    global _listener_thread

    if not _redis_url:
        logger.warning('Event bus: No Redis URL — event listener not started')
        return

    if not _subscriptions:
        logger.info('Event bus: No subscriptions — event listener not started')
        return

    if _listener_thread and _listener_thread.is_alive():
        logger.info('Event bus: Listener already running')
        return

    _listener_thread = threading.Thread(
        target=_listener_loop,
        args=(app, channel),
        daemon=True,
        name='event-bus-listener'
    )
    _listener_thread.start()
    logger.info(f'Event listener started on channel: {channel}')
