import requests
import logging
import time
import json
from functools import lru_cache

logger = logging.getLogger(__name__)


class CircuitBreaker:
    CLOSED = 'closed'
    OPEN = 'open'
    HALF_OPEN = 'half_open'

    def __init__(self, failure_threshold=5, recovery_timeout=30):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.state = self.CLOSED
        self.failure_count = 0
        self.last_failure_time = 0

    def can_execute(self):
        if self.state == self.CLOSED:
            return True
        if self.state == self.OPEN:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = self.HALF_OPEN
                return True
            return False
        return True

    def record_success(self):
        self.failure_count = 0
        self.state = self.CLOSED

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = self.OPEN
            logger.warning(f'Circuit breaker OPENED after {self.failure_count} failures')


class ServiceClient:

    def __init__(self, app=None):
        self.app = app
        self._service_urls = {}
        self._breakers = {}
        self._timeout = 3
        self._max_retries = 2
        self._session = requests.Session()

        if app:
            self.init_app(app)

    def init_app(self, app):
        self.app = app
        self._timeout = app.config.get('SERVICE_CLIENT_TIMEOUT', 3)
        self._max_retries = app.config.get('SERVICE_CLIENT_RETRIES', 2)

        self._service_urls = {
            'core': app.config.get('CORE_SERVICE_URL', 'http://core-service:5000'),
            'search': app.config.get('SEARCH_SERVICE_URL', 'http://search-service:5000'),
            'chat': app.config.get('CHAT_SERVICE_URL', 'http://chat-service:5000'),
            'learning': app.config.get('LEARNING_SERVICE_URL', 'http://learning-service:5000'),
            'notification': app.config.get('NOTIFICATION_SERVICE_URL', 'http://notification-service:5000'),
        }

        app.extensions['service_client'] = self

    def _get_breaker(self, service_name):
        if service_name not in self._breakers:
            self._breakers[service_name] = CircuitBreaker()
        return self._breakers[service_name]

    def _get_internal_token(self):
        try:
            from shared.jwt_auth import create_internal_token
            return create_internal_token()
        except Exception:
            return None

    def _build_url(self, service_name, path):
        base = self._service_urls.get(service_name)
        if not base:
            raise ValueError(f'Unknown service: {service_name}')
        return f'{base}{path}'

    def get(self, service_name, path, params=None, timeout=None):
        return self._request('GET', service_name, path,
                           params=params, timeout=timeout)

    def post(self, service_name, path, data=None, timeout=None):
        return self._request('POST', service_name, path,
                           json_data=data, timeout=timeout)

    def _request(self, method, service_name, path,
                 params=None, json_data=None, timeout=None):
        breaker = self._get_breaker(service_name)

        if not breaker.can_execute():
            logger.warning(
                f'Circuit open for {service_name} — skipping request to {path}'
            )
            return None

        url = self._build_url(service_name, path)
        timeout = timeout or self._timeout

        headers = {'Content-Type': 'application/json'}
        token = self._get_internal_token()
        if token:
            headers['Authorization'] = f'Bearer {token}'

        last_error = None
        for attempt in range(self._max_retries + 1):
            try:
                response = self._session.request(
                    method, url,
                    params=params,
                    json=json_data,
                    headers=headers,
                    timeout=timeout
                )

                if response.status_code >= 500:
                    raise requests.HTTPError(
                        f'{response.status_code} from {service_name}{path}'
                    )

                breaker.record_success()

                if response.status_code == 204:
                    return {}

                return response.json()

            except (requests.ConnectionError, requests.Timeout,
                    requests.HTTPError) as e:
                last_error = e
                if attempt < self._max_retries:
                    wait = 0.5 * (2 ** attempt)
                    logger.warning(
                        f'Retry {attempt + 1}/{self._max_retries} '
                        f'for {service_name}{path}: {e}'
                    )
                    time.sleep(wait)

        breaker.record_failure()
        logger.error(
            f'All retries failed for {service_name}{path}: {last_error}'
        )
        return None

    def get_user(self, uid):
        return self.get('core', f'/api/internal/user/{uid}')

    def get_tutor(self, tutor_id):
        return self.get('core', f'/api/internal/tutor/{tutor_id}')

    def get_slot(self, slot_id):
        return self.get('core', f'/api/internal/slot/{slot_id}')

    def get_tutors_batch(self, tutor_ids):
        if not tutor_ids:
            return []
        ids_str = ','.join(str(i) for i in tutor_ids)
        result = self.get('core', '/api/internal/tutors', params={'ids': ids_str})
        return result.get('tutors', []) if result else []


def get_service_client():
    from flask import current_app
    client = current_app.extensions.get('service_client')
    if not client:
        client = ServiceClient(current_app)
    return client
