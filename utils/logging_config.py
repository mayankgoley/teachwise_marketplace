import logging
import json
import sys
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }

        try:
            from flask import request, has_request_context
            if has_request_context():
                log_entry['request'] = {
                    'method': request.method,
                    'path': request.path,
                    'ip': request.remote_addr,
                    'user_agent': str(request.user_agent)[:200],
                }
                try:
                    from flask_login import current_user
                    if current_user and current_user.is_authenticated:
                        log_entry['user'] = {
                            'id': current_user.id,
                            'type': current_user.user_type,
                        }
                except Exception:
                    pass
        except Exception:
            pass

        if record.exc_info and record.exc_info[1]:
            log_entry['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
            }

        for key in ('duration_ms', 'status_code', 'booking_id', 'payment_id'):
            if hasattr(record, key):
                log_entry[key] = getattr(record, key)

        return json.dumps(log_entry, default=str)


def configure_logging(app):
    if app.debug:
        logging.basicConfig(level=logging.DEBUG)
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    handler.setLevel(logging.INFO)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    app.logger.handlers.clear()
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO)
    app.logger.propagate = False

    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

    @app.after_request
    def log_response(response):
        if not request.path.startswith('/static'):
            app.logger.info(
                'Request completed',
                extra={'status_code': response.status_code}
            )
        return response

    app.logger.info('JSON logging enabled')
