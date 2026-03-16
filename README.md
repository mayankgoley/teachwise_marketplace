# TeachWise

Online tutoring marketplace where students find, book, and attend live sessions with verified tutors. Handles payments via Stripe, real-time video through Jitsi, collaborative whiteboard, assignments, and guardian oversight for minors.

## Tech Stack

**Backend** — Python 3.12, Flask 2.3.3, SQLAlchemy, PostgreSQL 15, Redis, Celery, APScheduler
**Frontend** — Next.js 14 (App Router), TypeScript strict mode, Tailwind CSS 3.4, React 18
**Auth** — Flask-Login with four roles: student, tutor, admin, guardian
**Payments** — Stripe Checkout + Connect (tutor payouts), in-app wallet with top-up
**Real-time** — Flask-SocketIO, Socket.IO client, Jitsi Meet for video
**Search** — PostgreSQL full-text search (tsvector), PostGIS ST_DWithin for geo, Leaflet.js maps
**Storage** — Cloudflare R2 (documents, avatars, recordings)
**Calendar** — FullCalendar 6 (tutor availability management)
**Charts** — Chart.js + react-chartjs-2 (earnings dashboard)
**PDF** — fpdf2 for server-side report generation
**Monitoring** — Sentry (both frontend and backend)

## Quick Start

```bash
# Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                  # fill in your values
createdb teachwise
flask --app app db upgrade
python seed_test_data.py              # test users + tutor slots
flask --app app run --debug --port 5001

# Frontend (separate terminal)
cd frontend
cp .env.example .env.local            # fill in your values
npm install
npm run dev                           # http://localhost:3000
```

Both `.env.example` files document every required and optional variable with sensible defaults for local development.

The seed script creates test accounts, fills in the tutor profile (bio, location, rate, qualifications, weekly template), and generates two weeks of open availability slots. It also sets up the guardian-minor relationship.

## Test Accounts

All test accounts use password `Test@123`.

| Role | Email |
|------|-------|
| Student | teststudent@test.com |
| Tutor | testtutor@test.com |
| Admin | admin@teachwise.com |
| Guardian | guardian@test.com |
| Minor | minorstudent@test.com |

Login at `/login` — use the role tabs to switch between Student, Tutor, Admin, and Guardian.

The minor account (age ~15) is linked to the guardian. Booking requires guardian approval.

## Architecture

### How the frontend talks to the backend

The Next.js app proxies all API calls through `next.config.mjs` rewrites:

- `/api/*` → Flask at `http://localhost:5001/api/*`
- `/payment/webhook` → Flask webhook handler (Stripe needs this route directly)

This avoids CORS issues in development and keeps the Stripe webhook path working through the Next.js proxy layer. In production, you'd point these at your actual backend URL.

### API conventions

Every `/api/v1/*` endpoint returns a standard envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "message": "...", "code": "INVALID_INPUT" } }
```

The helpers `_ok()` and `_err()` in each `api_*.py` file enforce this. Frontend code in `lib/api.ts` unwraps the envelope automatically.

### Auth flow

1. User logs in via `POST /api/v1/{role}/login`
2. Flask sets a session cookie
3. Next.js middleware checks `GET /api/v1/auth/me` — redirects to `/login` if unauthenticated
4. `AuthContext` provides user state to all client components

### Theme

Dark/light mode via `ThemeContext` with `localStorage` persistence and `prefers-color-scheme` fallback.

## Frontend Structure

59 routes across public pages, auth flows, and four role-based dashboards.

```
frontend/
├── .env.example                      # all frontend env vars documented
├── next.config.mjs                   # API rewrites, security headers, Sentry, R2 images
├── tailwind.config.ts                # design tokens (colors, fonts, spacing, animations)
├── src/
│   ├── middleware.ts                 # auth guard for /dashboard routes
│   ├── app/
│   │   ├── layout.tsx                # root layout (fonts, ThemeProvider, AuthProvider)
│   │   ├── globals.css               # CSS vars (dark/light), grid overlay, gradients
│   │   ├── not-found.tsx             # branded 404
│   │   ├── (public)/
│   │   │   ├── page.tsx              # homepage (hero, categories, features, tutors, testimonials)
│   │   │   ├── search/page.tsx       # tutor search with filters, autocomplete, grid/map toggle
│   │   │   └── tutor/[id]/page.tsx   # public tutor profile with reviews + slot booking
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx        # multi-role login (student/tutor/admin/guardian tabs)
│   │   │   ├── signup/page.tsx       # student registration
│   │   │   ├── forgot-password/      # password reset request
│   │   │   ├── reset-password/       # password reset form
│   │   │   └── guardian/accept/      # guardian invitation acceptance
│   │   └── dashboard/
│   │       ├── layout.tsx            # shared sidebar layout (role-based nav)
│   │       ├── student/              # dashboard, bookings, wallet, assignments, progress, messages, notifications, profile, settings
│   │       ├── tutor/                # dashboard, availability, students, assignments, messages, earnings, documents, reschedule, notifications, profile
│   │       ├── admin/                # dashboard, users, bookings, verification, analytics, moderation, recordings, audit, settings
│   │       └── guardian/             # dashboard, children, approvals, spending, messages, notifications
│   ├── context/
│   │   ├── ThemeContext.tsx           # dark/light toggle
│   │   ├── AuthContext.tsx           # user session state, login/logout
│   │   └── ToastContext.tsx          # toast notification system
│   ├── lib/
│   │   ├── api.ts                    # apiGet/apiPost/apiPut/apiPatch/apiDelete with credentials
│   │   └── format.ts                # currency, date, time, relative time, duration formatters
│   ├── types/
│   │   ├── auth.ts                   # User, UserRole, LoginCredentials
│   │   └── search.ts                # TutorSearchResult, TutorProfile, AvailableSlot, etc.
│   └── components/
│       ├── ui/                       # StarCanvas, LoadingScreen, Avatar, StatCard, StatusBadge, DataTable, EmptyState, etc.
│       ├── layout/
│       │   ├── NavBar.tsx            # fixed nav with backdrop blur, auth-aware CTA
│       │   └── DashboardLayout.tsx   # sidebar with role-based navigation
│       ├── sections/                 # homepage sections (Hero, TrustStrip, HowItWorks, etc.)
│       └── features/                 # ChatBot, StarRating, TutorCard, MapView, SlotPicker
```

### Key packages

| Package | Purpose |
|---------|---------|
| next 14.2 | App Router framework |
| react 18 | UI |
| tailwindcss 3.4 | Styling |
| leaflet + react-leaflet 4.2.1 | Map view (pinned to v4 for React 18) |
| @fullcalendar 6.1 | Tutor availability calendar |
| chart.js + react-chartjs-2 | Earnings charts |
| socket.io-client 4.8 | Real-time notifications |
| lucide-react | Icons |
| @sentry/nextjs | Error tracking |

### Design tokens

From the approved redesign mockups:
- **Fonts** — Cormorant Garamond (headings), DM Sans (body)
- **Dark** — `#03040a` bg, `#4f8eff` accent, `#00e5ff` secondary, `#ff4fd8` tertiary
- **Light** — `#f4f6fb` bg, `#ffffff` surface, `#0d1117` text
- **Animations** — fadeUp, shimmer, pulse, drift, scan (all in `tailwind.config.ts`)

## Flask API Endpoints

### Auth (`routes/api_auth.py`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/auth/me` | Any | Current session user |
| POST | `/api/v1/auth/logout` | Any | Destroy session |
| POST | `/api/v1/student/login` | Public | Student login |
| POST | `/api/v1/tutor/login` | Public | Tutor login |
| POST | `/api/v1/admin/login` | Public | Admin login |
| POST | `/api/v1/guardian/login` | Public | Guardian login |

### Dashboards (`routes/api_dashboard.py`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/student/dashboard` | Student | Stats, upcoming sessions, recent activity |
| GET | `/api/v1/tutor/dashboard` | Tutor | Stats, pending reviews, schedule, earnings |
| GET | `/api/v1/admin/dashboard` | Admin | User counts, revenue, bookings, verifications |
| GET | `/api/v1/guardian/dashboard` | Guardian | Children, approvals, activity, spending |

### Search (`routes/api_search.py`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/search/tutors` | Public | Search with filters (subject, location, price, rating, mode) |
| GET | `/api/v1/search/suggestions` | Public | Autocomplete (subjects + tutor names) |
| GET | `/api/v1/search/recent` | Student | Recent search history (Redis-backed) |
| POST | `/api/v1/search/recent` | Student | Save a search query |

### Tutor Public (`routes/api_tutor_public.py`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/tutors/{id}/profile` | Public | Full profile with reviews and rating breakdown |
| GET | `/api/v1/tutors/{id}/slots` | Public | Available slots in date range |
| POST | `/api/v1/student/favorites` | Student | Toggle favorite tutor |
| GET | `/api/v1/student/favorites` | Student | List favorites |

### Student Features (`routes/api_student_features.py`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/student/wallet` | Student | Balance + paginated transactions |
| POST | `/api/v1/student/wallet/topup` | Student | Create Stripe Checkout for top-up |
| GET | `/api/v1/student/notifications` | Student | Paginated with unread count |
| POST | `/api/v1/student/notifications/{id}/read` | Student | Mark read |
| POST | `/api/v1/student/notifications/read-all` | Student | Mark all read |
| GET | `/api/v1/student/bookings` | Student | Paginated with cancel/review flags |
| POST | `/api/v1/bookings/create` | Student | Create booking (Stripe + guardian approval) |
| POST | `/api/v1/bookings/{id}/cancel` | Student | Cancel with refund calculation |
| POST | `/api/v1/bookings/{id}/review` | Student | Submit review with dimension ratings |

### Tutor Features (`routes/api_tutor_features.py`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/tutor/slots` | Tutor | All slots with booking info |
| POST | `/api/v1/tutor/slots` | Tutor | Create slot (overlap check) |
| DELETE | `/api/v1/tutor/slots/{id}` | Tutor | Delete (blocked if booked) |
| GET | `/api/v1/tutor/earnings` | Tutor | Summary, history, 6-month chart, Stripe status |
| GET | `/api/v1/tutor/students` | Tutor | Student list with session stats |

## Backend Structure

```
TeachWise/
├── app.py                       # app factory, blueprints, CORS, SocketIO, error handlers
├── database.py                  # SQLAlchemy init
├── config.py                    # environment-based config
├── extensions.py                # shared extensions (limiter, socketio)
├── models/
│   ├── __init__.py              # all models registered here
│   ├── student.py               # has_seen_tour, guardian_id
│   ├── tutor.py                 # onboarding_step, stripe_account_id
│   ├── guardian.py
│   ├── admin.py
│   ├── booking.py               # cancellation_reason, guardian_approved
│   ├── slots.py                 # location fields, jitsi_room_name
│   ├── review.py                # dimension ratings (knowledge, communication, etc.)
│   ├── payment.py               # platform_fee, tutor_payout
│   ├── wallet.py
│   ├── wallet_transaction.py
│   ├── tutor_document.py        # expiry_date
│   ├── message.py               # Conversation + Message
│   ├── assignment.py            # Assignment + Submission
│   ├── recording.py
│   ├── session_note.py
│   ├── learning_goal.py         # LearningGoal + ProgressEntry
│   ├── in_app_notification.py
│   ├── chatbot.py               # ChatbotConversation + ChatbotMessage
│   ├── favorite.py
│   ├── whiteboard.py
│   ├── student_saved_location.py
│   ├── refund_request.py
│   ├── audit_log.py
│   ├── content_report.py
│   ├── guardian_message.py
│   └── platform_setting.py
├── routes/
│   ├── api_auth.py              # /api/v1/auth/*
│   ├── api_dashboard.py         # /api/v1/{role}/dashboard
│   ├── api_search.py            # /api/v1/search/*
│   ├── api_tutor_public.py      # /api/v1/tutors/{id}/*
│   ├── api_student_features.py  # /api/v1/student/*
│   ├── api_tutor_features.py    # /api/v1/tutor/*
│   ├── student_routes.py        # legacy Jinja2
│   ├── tutor_routes.py
│   ├── admin_routes.py
│   ├── guardian_routes.py
│   ├── payment_routes.py        # Stripe webhooks, checkout callbacks
│   ├── session_routes.py        # Jitsi room management
│   ├── chat_routes.py           # real-time messaging (Socket.IO)
│   ├── assignment_routes.py
│   ├── whiteboard_routes.py
│   ├── recording_routes.py
│   ├── note_routes.py
│   ├── progress_routes.py
│   ├── search_routes.py
│   ├── notification_center_routes.py
│   ├── reschedule_routes.py
│   ├── wallet_routes.py
│   └── doc_routes.py
├── services/
│   ├── search_service.py        # tsvector + PostGIS queries
│   ├── booking_service.py       # create, cancel, refund calculation
│   ├── payment_service.py       # Stripe Checkout + Connect
│   ├── cache_service.py         # Redis helpers
│   ├── recommendation_service.py
│   ├── encryption_service.py
│   └── scheduler_service.py
├── shared/
│   ├── event_bus.py             # Redis pub/sub
│   └── service_client.py       # inter-service HTTP client
├── templates/                   # remaining Jinja2 (error pages, Stripe redirects, real-time features)
├── templates/_archived/         # migrated Jinja2 templates (kept for reference)
├── static/
├── chatbot/                     # AI chatbot backend + widget
├── migrations/                  # Alembic
├── tests/
├── seed_test_data.py
├── .env.example
└── requirements.txt
```

### Templates status

Most Jinja2 templates have been replaced by the Next.js frontend and moved to `templates/_archived/`. The remaining templates in `templates/` are:

- **Error pages** — `404.html`, `500.html`
- **Stripe redirects** — `payment_checkout.html`, `payment_success.html`, `payment_cancel.html`
- **Real-time features** — `session_whiteboard.html`, `session_notes.html` (Socket.IO)
- **Media** — `recordings_list.html`, `view_recording.html`
- **File upload** — `submit_assignment.html`, `review_submission.html`
- **Other** — `refund_request.html`

These will be migrated in a future phase.

## Database

35 tables on PostgreSQL 15. Migrations managed by Alembic (`flask db upgrade` / `flask db migrate`).

Key relationships:
- Students can have a guardian (optional, for minors)
- Bookings link a student to a tutor slot, with optional guardian approval
- Wallet transactions track top-ups and session charges
- Reviews have dimension ratings (knowledge, communication, punctuality, etc.)
- Tutors upload verification documents with expiry dates

## Tests

```bash
pytest tests/ -v
pytest tests/ --cov=. --cov-report=html
```

Test coverage includes unit tests, integration tests, payment flow tests, security tests, and performance benchmarks.

## Docker

```bash
docker-compose up --build
```

Runs Flask (Gunicorn with gevent), PostgreSQL 15, and Redis 7.

## Troubleshooting

**Loading screen stuck on "Initializing your experience"**
Stale Next.js cache. Delete `.next` and restart:
```bash
cd frontend && rm -rf .next && npm run dev
```

**"Cannot find module" errors after pulling changes**
Same thing — stale `.next/server` webpack chunks. Delete `.next` and restart.

**API calls returning 404 HTML instead of JSON**
Make sure `frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:5001`.

**"Invalid email or password" on login**
All test accounts use `Test@123`. Run `python seed_test_data.py` if they don't exist yet.

**react-leaflet peer dependency warning**
Expected — react-leaflet v5 needs React 19. We pin `react-leaflet@4.2.1` for React 18 compatibility.

**`geoalchemy2` import error during migrations**
Install it (`pip install geoalchemy2`) or skip the geo migration if you don't need location search locally.
