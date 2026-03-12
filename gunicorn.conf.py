import os

bind = '0.0.0.0:5000'

worker_class = 'geventwebsocket.gunicorn.workers.GeventWebSocketWorker'
workers = int(os.environ.get('GUNICORN_WORKERS', 4))
worker_connections = 1500
timeout = 120
graceful_timeout = 30
preload_app = True

accesslog = '-'
errorlog = '-'
loglevel = os.environ.get('LOG_LEVEL', 'info')
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

limit_request_line = 8190
limit_request_fields = 100

def post_fork(server, worker):
    """Only worker 1 runs the scheduler."""
    worker_id = getattr(worker, 'worker_id', None)
    if worker_id is None:
        worker_id = worker.age
    os.environ['WORKER_ID'] = str(worker_id)
    if worker.age == 1:
        os.environ['RUN_SCHEDULER'] = 'true'
    else:
        os.environ['RUN_SCHEDULER'] = 'false'
