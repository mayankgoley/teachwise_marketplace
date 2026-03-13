# TeachWise

Online tutoring marketplace where students find, book, and attend live sessions with verified tutors. Handles payments via Stripe, real-time video through Jitsi, collaborative whiteboard, assignments, and guardian oversight for minors.

## Tech Stack

**Backend** — Python 3.12, Flask, SQLAlchemy, PostgreSQL, Redis, Celery, APScheduler
**Auth** — Flask-Login with four roles: student, tutor, admin, guardian
**Payments** — Stripe Checkout + Connect (tutor payouts)
**Real-time** — Flask-SocketIO, Jitsi Meet for video
**Search** — PostgreSQL full-text search (tsvector), Leaflet.js maps
**Storage** — Cloudflare R2
**Frontend** — Jinja2 templates, Tailwind CSS, vanilla JS, Chart.js, FullCalendar, Cropper.js, Shepherd.js
**PDF** — fpdf2 for server-side report generation

## What's in Here

### Student side
- Dashboard with session stats, spending totals, and upcoming count
- Booking management with list + calendar views (FullCalendar), CSV/PDF export, date filtering
- Cancel bookings through a modal that tracks the reason
- Favorites page with sort (name, rating, price) and subject filter
- Tutor profiles with booking confirmation, similar tutor suggestions, conflict warnings
- Guided onboarding tour for new students (Shepherd.js)
- "Book Again" shortcut on completed sessions

### Tutor side
- Earnings line chart + sessions bar chart (Chart.js, 12-month rolling)
- Profile completeness ring — 10 weighted fields, links to fix what's missing
- Photo crop on upload (Cropper.js, 1:1, 400x400 output)
- Bulk slot creation via drag-to-select weekly grid
- Recurring weekly availability templates
- Earnings export as PDF with summary, monthly breakdown, transaction detail
- Document upload with real-time progress bar, expiry date tracking + dashboard alerts
- Stripe Connect status banners (not connected / pending / connected)
- Student list with search, sort, subject filter
- Bulk accept/decline for reschedule requests
- 5-step onboarding wizard (bio, rates, availability, documents, Stripe) + dashboard tour

## Quick Start

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# set DATABASE_URL, SECRET_KEY, FERNET_KEY in .env (or copy .env.example)
createdb teachwise
flask --app app db upgrade
python seed_test_data.py          # populates test users + tutor slots
flask --app app run --debug --port 5001
```

The seed script fills in the test tutor's profile (bio, location, rate, qualification, weekly template) and generates two weeks of open availability slots. It also creates the guardian and minor student if they don't exist yet.

## Test Accounts

All test passwords were last reset on March 11, 2026.

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@teachwise.com | `admin123` |
| Tutor | testtutor@test.com | `TestPass123!` |
| Student | teststudent@test.com | `TestPass123!` |
| Student | priyankasridhar832@gmail.com | `TestPass123!` |
| Guardian | guardian@test.com | `TestPass123!` |
| Minor | minorstudent@test.com | `TestPass123!` |

Login pages:

- Students — `/student/login`
- Tutors — `/tutor/login`
- Guardians — `/guardian/login`
- Admin panel — `/admin/login`

The minor account (age ~15) is linked to the guardian. Booking requires guardian approval.

## Project Layout

```
TeachWise/
├── app.py                   # app factory, blueprint registration
├── database.py              # SQLAlchemy init
├── config.py                # environment-based config
├── models/
│   ├── tutor.py             # includes onboarding_step, has_seen_tour
│   ├── student.py           # includes has_seen_tour
│   ├── booking.py           # includes cancellation_reason
│   ├── tutor_document.py    # includes expiry_date
│   ├── slots.py             # availability with location fields
│   ├── admin.py
│   └── guardian.py
├── routes/
│   ├── student_routes.py    # dashboard, bookings, favorites, export, onboarding
│   ├── tutor_routes.py      # dashboard, earnings, students, bulk slots, setup wizard
│   ├── reschedule_routes.py # reschedule handling + bulk actions
│   ├── admin_routes.py
│   └── guardian_routes.py
├── templates/               # Jinja2, extends base.html, Tailwind
├── static/                  # CSS, JS, uploaded files
├── migrations/              # Alembic (current head: f6a7b8c9d0e1)
├── seed_test_data.py
└── requirements.txt
```

## Tests

```bash
pytest tests/ -v
pytest tests/ --cov=. --cov-report=html
```

## Docker

```bash
docker-compose up --build
```

Runs Flask (Gunicorn), PostgreSQL 15, and Redis 7.
