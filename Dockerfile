FROM python:3.12-slim

# System dependencies for psycopg2 and python-magic
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd --create-home appuser

WORKDIR /app

# Install Python dependencies (including gunicorn + gevent)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads && chown -R appuser:appuser /app

USER appuser

EXPOSE 5000

# Use gevent WebSocket worker for high concurrency + SocketIO support
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:app"]
