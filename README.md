# TeachWise

Online tutoring marketplace — students find, book, and have live sessions with verified tutors. Supports payments, real-time chat, video sessions, a collaborative whiteboard, assignments, and guardian oversight for minors.

## Tech Stack

- **Backend:** Python 3.12, Flask, SQLAlchemy, PostgreSQL
- **Auth:** Flask-Login (student, tutor, admin, guardian roles)
- **Payments:** Stripe Checkout + Connect
- **Real-time:** Flask-SocketIO, Jitsi Meet (video)
- **Search:** PostgreSQL full-text (tsvector), Leaflet.js maps
- **Storage:** Cloudflare R2
- **Cache/Queue:** Redis, APScheduler, Celery
- **Frontend:** Jinja2 + Tailwind CSS + vanilla JS

## Quick Start

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# copy .env.example or set DATABASE_URL, SECRET_KEY, FERNET_KEY at minimum
createdb teachwise
flask --app app db upgrade
flask --app app run --debug --port 5001
```

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@teachwise.com | admin123 |
| Tutor | testtutor@test.com | TestPass123!@# |
| Student | teststudent@test.com | TestPass123!@# |
| Guardian | guardian@test.com | TestPass123!@# |
| Minor | minorstudent@test.com | TestPass123!@# |

Admin panel: http://localhost:5001/admin/login

## Running Tests

```bash
pytest tests/ -v
pytest tests/ --cov=. --cov-report=html
```

## Docker

```bash
docker-compose up --build
```

Starts the Flask app (Gunicorn), PostgreSQL 15, and Redis 7.
