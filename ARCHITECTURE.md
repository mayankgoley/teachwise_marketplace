# Architecture

Flask + Next.js 14, Postgres (PostGIS), Redis, Stripe, Jitsi, Cloudflare R2.
Roles: student, tutor, admin, guardian.

## 1. System layout

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Next.js 14 Frontend (TypeScript + Tailwind CSS)     │   │
│  │  - React 18 with App Router                          │   │
│  │  - Turbopack dev server                              │   │
│  │  - Socket.IO client (chat, whiteboard)               │   │
│  │  - Stripe.js (checkout)                              │   │
│  │  - Jitsi SDK (video sessions)                        │   │
│  │  - Fabric.js (collaborative whiteboard)              │   │
│  │  - Leaflet (map search)                              │   │
│  │  - Recharts (analytics charts)                       │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / WebSocket
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   API GATEWAY (Nginx)                       │
│  - SSL/TLS termination          - Rate limiting             │
│  - Load balancing (3 replicas)  - Gzip compression          │
│  - WebSocket upgrade            - Security headers          │
└───────┬──────────────────┬──────────────────┬───────────────┘
        │                  │                  │
   ┌────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐
   │   Core    │    │   Search    │    │   Chat      │
   │  Service  │    │   Service   │    │   Service   │
   │ (Flask)   │    │  (Flask)    │    │  (Flask)    │
   └────┬──────┘    └──────┬──────┘    └──────┬──────┘
        │                  │                  │
   ┌────▼──────┐    ┌──────▼──────┐          │
   │ Learning  │    │Notification │          │
   │  Service  │    │   Service   │          │
   │  (Flask)  │    │   (Flask)   │          │
   └────┬──────┘    └──────┬──────┘          │
        │                  │                  │
┌───────▼──────────────────▼──────────────────▼───────────────┐
│                 SHARED INFRASTRUCTURE                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  PostgreSQL   │  │    Redis     │  │   PgBouncer      │   │
│  │  + PostGIS    │  │  (Upstash)   │  │   (pool: 50)     │   │
│  │  31 tables    │  │  512MB LRU   │  │   txn mode       │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              EXTERNAL SERVICES                               │
│  Stripe    Jitsi    Cloudflare R2   Resend   Sentry         │
│  (pay)     (video)  (storage)       (email)  (errors)       │
│                     OpenStreetMap   OpenAI                    │
│                     (geocoding)     (chatbot)                │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Backend Architecture (Flask)

### 2.1 Core Configuration

| Setting | Value |
|---------|-------|
| Framework | Flask 2.x with Gunicorn + gevent |
| Database | PostgreSQL 15 with PostGIS |
| ORM | SQLAlchemy 2.x with Flask-Migrate (Alembic) |
| Connection pool | PgBouncer (50 per pool, 1000 max clients) |
| Cache/Sessions | Redis (Upstash in prod, filesystem fallback in dev) |
| Rate limiting | Flask-Limiter (200/hr default, 10/15min login) |
| Task queue | Celery with Redis broker |
| Scheduler | APScheduler (reminders, cleanup, data consistency) |
| Auth | Flask-Login with server-side sessions |
| Encryption | Fernet (symmetric) for sensitive fields |
| Real-time | Flask-SocketIO with Redis message queue |
| CORS | localhost:3000 (dev) + teachwiseedu.com (prod) |
| Error tracking | Sentry (production only, 5% sample rate) |

### 2.2 Database Models (31 tables)

#### Core User Models

**Student**: name, email, password, DOB, major, grade_level, bio, timezone, lat/long, city, guardian_id (for minors), notification preferences, account lockout fields, `is_minor` computed property

**Tutor**: name, email, password, subjects (primary + JSON additional), experience, bio, qualification, institution, hourly_rate, teaching_mode (online/in-person/both), profile_photo, timezone, address, emergency_contact, verification_status (pending_documents > documents_submitted > under_review > verified/rejected), Stripe account_id, rating_avg, total_reviews, total_sessions_completed, response_time_avg, location (lat/lng/city/service_radius_km), search_vector (full-text), onboarding_step

**Guardian**: name, email, phone (Fernet encrypted), relationship, is_verified, child notification config, spending limits (weekly/monthly), account lockout

**Admin**: name, email, password, role (reviewer/verification_officer/admin/superadmin), timezone

#### Booking & Payment

**TutorSlot**: tutor_id, student_id, date, start/end time, mode, subject, price, is_group, max_students, current_students, status (pending > booked > live > completed/cancelled), jitsi_room_name, reminder tracking (24h/1h sent), location fields, cancellation_reason

**Booking**: student_id, tutor_id, slot_id, status (Booked > Confirmed > Completed/Cancelled), guardian_approved (null/true/false for minors), recording_consent (student + tutor), meeting_location (type/address/coordinates), cancellation fields

**Payment**: booking_id, student_id, tutor_id, amount, platform_fee (15%), tutor_payout, stripe_checkout_session_id, stripe_payment_intent_id, status (pending > completed/refunded/failed), refund fields

**Wallet**: student_id (unique), balance, currency (USD)

**WalletTransaction**: wallet_id, amount, type (topup/booking_payment/refund/bonus), description, reference_id, stripe_charge_id, balance_after

#### Messaging

**Conversation**: student_id + tutor_id (unique pair), started_by, is_blocked flags, last_message_at

**Message**: conversation_id, sender_type/id, content, status (sent > delivered > read), message_type (text/image/file), file sharing fields (url/name/size/mime), edited_at, is_deleted

**GuardianMessage**: guardian_id, tutor_id, student_id, sender_type, content, is_read

#### Learning & Progress

**Assignment**: tutor_id, student_id, title, description, subject, due_date, status (assigned > submitted > reviewed > overdue), file_urls (JSON), rubric (JSON with criteria/max_points), late submission config (allow/grace_period/penalty), resubmission config

**Submission**: assignment_id, student_id, text_response, file_urls, grade, feedback, rubric_scores (JSON), is_late, late_hours, resubmission support

**LearningGoal**: student_id, tutor_id, title, description, status (active/completed/paused), target_date, skill_tags (JSON)

**ProgressEntry**: goal_id, slot_id, note, rating (1-5), created_by

#### Session Features

**SessionRecording**: slot_id, booking_id, R2 object key, file_encryption_key, duration, quality, consent flags, expires_at, is_deleted

**SessionNote**: slot_id, author_type/id, content, is_private, attachments (JSON with encryption keys)

**NoteVersion**: note_id, content, edited_by (edit history)

**WhiteboardSession**: slot_id, json_state (Fabric.js), thumbnail (base64), snapshots (JSON)

#### Reviews & Reputation

**Review**: student_id, tutor_id, booking_id, rating (overall 1-5), dimension ratings (knowledge/communication/punctuality/value), comment, tutor_response, is_verified

**ReviewReport**: review_id, reporter, reason (spam/inappropriate/fake), status (pending/reviewed/dismissed)

**ReviewVote**: review_id, voter_id/type, is_helpful

#### Documents & Verification

**TutorDocument**: tutor_id, document_type (government_id/degree/certification/teaching_license), original_filename, r2_object_key, file_encryption_key, verification_hash (SHA-256), status (pending/approved/rejected), 90-day retention tracking, expiry_date

#### Reschedule & Refund

**RescheduleRequest**: booking_id, original_slot_id, proposed_slot_id, requested_by (student/tutor), status (pending/approved/rejected/expired), reason, expires_at (48h), guardian approval flag

**RefundRequest**: payment_id, student_id, booking_id, reason, refund_percentage/amount, status, admin_note

#### Other

**InAppNotification**: user_id/type, notification type, title/message/icon/color, source_id, group_key, is_read

**EmailNotification**: recipient, email_type, subject, status (queued/sent/failed), related_booking_id

**AuditLog**: admin_id/name, action, target_type/id, details (JSON), ip_address

**FavoriteTutor**: student_id, tutor_id (unique)

**StudentSavedLocation**: student_id, label, address, lat/lng, type (home/work/other), is_primary

**PlatformSetting**: key-value admin configuration

**ContentReport**: reporting inappropriate content

### 2.3 API Endpoints (329+ across 40 route files)

All endpoints return: `{"success": true, "data": {...}}` or `{"success": false, "error": {"message": "...", "code": 400}}`

#### Authentication (`api_auth.py`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/auth/logout` | Logout |
| POST | `/api/v1/student/login` | Student login |
| POST | `/api/v1/tutor/login` | Tutor login |
| POST | `/api/v1/admin/login` | Admin login |
| POST | `/api/v1/guardian/login` | Guardian login |
| POST | `/api/v1/student/register` | Student signup |
| POST | `/api/v1/tutor/register` | Tutor signup |
| POST | `/api/v1/guardian/invite` | Guardian invitation |
| POST | `/api/v1/auth/forgot-password` | Password reset request |
| POST | `/api/v1/auth/reset-password` | Reset with token |
| GET | `/api/v1/auth/verify-email` | Email verification |
| POST | `/api/v1/auth/resend-verification` | Resend verification |

#### Dashboard (`api_dashboard.py`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/student/dashboard` | Student stats, upcoming sessions, goals |
| GET | `/api/v1/tutor/dashboard` | Tutor stats, students, earnings, reviews |
| GET | `/api/v1/admin/dashboard` | System stats, users, revenue |
| GET | `/api/v1/guardian/dashboard` | Children, approvals, spending |

#### Search (`api_search.py`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/search/tutors` | Search with filters (subject, price, rating, location, mode) |
| GET | `/api/v1/search/suggestions` | Autocomplete suggestions |
| GET | `/api/v1/search/recent` | Recent search history |

#### Tutor Public (`api_tutor_public.py`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/tutors/:id/profile` | Public tutor profile |
| GET | `/api/v1/tutors/:id/slots` | Available slots |
| POST | `/api/v1/student/favorites` | Add/remove favorite |
| GET | `/api/v1/student/favorites` | List favorites |

#### Tutor Profile (`api_tutor_profile.py`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/tutor/profile` | Get profile |
| PUT | `/api/v1/tutor/profile` | Update profile |
| POST | `/api/v1/tutor/profile/avatar` | Upload photo |
| PUT | `/api/v1/tutor/profile/location` | Update location |
| PUT | `/api/v1/tutor/profile/notifications` | Notification prefs |

#### Tutor Slots & Features (`api_tutor_features.py`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/tutor/slots` | Get slots (date range) |
| POST | `/api/v1/tutor/slots` | Create slot |
| DELETE | `/api/v1/tutor/slots/:id` | Delete slot |
| POST | `/api/v1/tutor/slots/recurring` | Create recurring slots |
| GET | `/api/v1/tutor/earnings` | Earnings summary |
| GET | `/api/v1/tutor/students` | Students list |

#### Student Bookings (`api_student_features.py`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/student/bookings` | Booking history |
| POST | `/api/v1/bookings/create` | Create booking (with hold verification) |
| POST | `/api/v1/bookings/:id/cancel` | Cancel booking |
| POST | `/api/v1/bookings/:id/review` | Submit review |
| POST | `/api/v1/slots/:id/hold` | Place 8-min hold on slot |
| DELETE | `/api/v1/slots/:id/hold` | Release slot hold |
| GET | `/api/v1/slots/:id/availability` | Real-time availability |

#### Wallet
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/student/wallet` | Balance and transactions |
| POST | `/api/v1/student/wallet/topup` | Top up via Stripe |

#### Chat (`api_chat.py`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/chat/conversations` | List conversations |
| GET | `/api/v1/chat/conversations/:id/messages` | Get messages |
| POST | `/api/v1/chat/conversations/:id/messages` | Send message |
| POST | `/api/v1/chat/conversations/start` | Start conversation |

#### Sessions (`api_session.py`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/session/:slot_id/join` | Join session (Jitsi config) |
| POST | `/api/v1/session/:slot_id/end` | End session |
| GET | `/api/v1/session/:slot_id/summary` | Session summary |
| GET | `/api/v1/session/:slot_id/receipt` | Session receipt |

#### Assignments (`api_assignments.py`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/student/assignments` | Student's assignments |
| POST | `/api/v1/student/assignments/:id/submit` | Submit assignment |
| GET | `/api/v1/tutor/assignments` | Tutor's assignments |
| POST | `/api/v1/tutor/assignments` | Create assignment |
| POST | `/api/v1/tutor/assignments/:id/grade` | Grade submission |

#### Progress (`api_progress.py`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/student/goals` | Learning goals |
| POST | `/api/v1/student/goals` | Create goal |
| PATCH | `/api/v1/student/goals/:id` | Update goal |
| POST | `/api/v1/goals/:id/entries` | Add progress entry |
| GET | `/api/v1/student/progress/chart` | Chart data |

#### Reschedule (`api_reschedule.py`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/bookings/:id/reschedule-options` | Available reschedule slots |
| POST | `/api/v1/bookings/:id/reschedule` | Student requests reschedule (with chat message) |
| POST | `/api/v1/tutor/bookings/:id/propose-reschedule` | Tutor proposes new time (with chat message) |
| POST | `/api/v1/tutor/reschedule-requests/:id/approve` | Tutor approves |
| POST | `/api/v1/tutor/reschedule-requests/:id/reject` | Tutor rejects |
| POST | `/api/v1/student/reschedule-requests/:id/accept` | Student accepts |
| POST | `/api/v1/student/reschedule-requests/:id/cancel-and-refund` | Cancel with full refund |
| POST | `/api/v1/guardian/reschedule-requests/:id/approve` | Guardian approves |

#### Admin (`api_admin.py`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/admin/users` | User management (with filters) |
| POST | `/api/v1/admin/users/:type/:id/suspend` | Suspend user |
| GET | `/api/v1/admin/verification` | Verification queue |
| POST | `/api/v1/admin/verification/:id/approve` | Approve tutor |
| POST | `/api/v1/admin/verification/:id/reject` | Reject tutor |
| GET | `/api/v1/admin/analytics` | System analytics |
| GET | `/api/v1/admin/moderation` | Content reports |
| GET | `/api/v1/admin/audit-log` | Audit log |
| GET | `/api/v1/admin/recordings` | Recording management |

#### Guardian (`api_guardian_features.py`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/guardian/children` | Linked children |
| GET | `/api/v1/guardian/children/:id/activity` | Child activity |
| POST | `/api/v1/guardian/approvals/:id/approve` | Approve booking |
| GET | `/api/v1/guardian/spending` | Spending tracking |
| PUT | `/api/v1/guardian/spending/limits` | Set spending limits |

#### Payment (`payment_routes.py`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/payment/webhook` | Stripe webhook (CSRF exempt) |
| GET | `/tutor/stripe-onboard` | Stripe Connect onboarding |
| POST | `/payment/checkout/:id/proceed` | Process checkout |
| GET | `/payment/:id/invoice` | Payment invoice |

### 2.4 Services (21 service files)

| Service | Purpose |
|---------|---------|
| `booking_service.py` | Create booking (SELECT FOR UPDATE locking), cancel with refund, reopen slot |
| `booking_hold_service.py` | Redis SETNX + in-memory fallback for concurrency-safe slot holds (8-min TTL) |
| `payment_service.py` | Stripe checkout, payment processing, refunds, Connect onboarding |
| `email_service.py` | Email via Resend.com (booking confirmations, reminders, password reset) |
| `notification_service.py` | In-app notification aggregation |
| `search_service.py` | Full-text + geo-spatial tutor search |
| `recommendation_service.py` | Weighted recommendations (subject 40%, rating 25%, distance 20%, experience 10%, availability 5%) |
| `storage_service.py` | Cloudflare R2 upload/download with per-file encryption |
| `encryption_service.py` | Fernet encrypt/decrypt for sensitive fields |
| `cache_service.py` | Redis get/set/delete with pattern support |
| `video_service.py` | Jitsi room name generation |
| `invoice_service.py` | PDF invoice generation (fpdf2) |
| `geocoding_service.py` | OpenStreetMap Nominatim forward/reverse geocoding |
| `location_service.py` | Student location updates |

### 2.5 Background Jobs (APScheduler)

| Job | Interval | Purpose |
|-----|----------|---------|
| `check_reminders` | 15 min | Send 24h and 1h pre-session email reminders |
| `cleanup_expired_documents` | Daily 3 AM | Delete files past 90-day retention |
| `cleanup_expired_recordings` | Daily 4 AM | Remove expired session recordings |
| `check_overdue_assignments` | Daily 8 AM | Mark past-due assignments as overdue |
| `check_expired_reschedules` | Hourly | Expire pending reschedule requests after 48h |

---

## 3. Frontend Architecture (Next.js 14)

### 3.1 Directory Structure

```
frontend/src/
├── app/                          # App Router
│   ├── (auth)/                   # Login, signup, forgot-password, reset
│   ├── (public)/                 # Search, tutor profile, terms, privacy
│   ├── dashboard/
│   │   ├── student/              # 11 pages (bookings, wallet, messages, etc)
│   │   ├── tutor/                # 11 pages (availability, earnings, etc)
│   │   ├── admin/                # 9 pages (users, analytics, verification, etc)
│   │   └── guardian/             # 7 pages (children, approvals, spending, etc)
│   ├── session/[slotId]/         # Live session room + summary
│   └── layout.tsx                # Root layout with providers
├── components/
│   ├── ui/                       # Avatar, AuthCard, DataTable, EmptyState, etc
│   ├── features/                 # SlotPicker, Whiteboard, TutorCalendar, etc
│   ├── layout/                   # NavBar, DashboardLayout (sidebar + prefetch)
│   └── sections/                 # Landing page (Hero, Features, Testimonials)
├── context/
│   ├── AuthContext.tsx            # User state, login/logout/refetch
│   ├── ThemeContext.tsx           # Dark/light mode (localStorage)
│   └── ToastContext.tsx           # Toast notifications
├── lib/
│   ├── api.ts                    # Fetch wrapper (apiGet/Post/Put/Delete + ApiError)
│   ├── auth-utils.ts             # Dashboard path resolver
│   └── format.ts                 # Date, time, currency, duration formatters
├── types/                        # TypeScript interfaces for all data models
└── middleware.ts                  # Auth redirect for protected routes
```

### 3.2 Page Routes (58 pages)

**Public**: `/`, `/search`, `/tutor/[id]`, `/features`, `/terms`, `/privacy`, `/support`, `/careers`, `/categories`, `/categories/[slug]`

**Auth**: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/register-tutor`, `/guardian/accept`

**Student Dashboard**: Main, Bookings, Bookings/Reschedule/[id], Profile, Messages, Notifications, Assignments, Progress, Wallet, Settings, Reschedule-Requests

**Tutor Dashboard**: Main, Profile, Availability, Documents, Earnings, Students, Messages, Notifications, Assignments, Assignments/Create, Reschedule-Requests

**Admin Dashboard**: Main, Users, Verification, Bookings, Analytics, Moderation, Audit, Recordings, Settings

**Guardian Dashboard**: Main, Children, Children/[id]/Activity, Approvals, Spending, Messages, Notifications, Activity

**Session**: `/session/[slotId]` (live room with Jitsi + whiteboard), `/session/[slotId]/summary`

### 3.3 Key Components

| Component | Purpose |
|-----------|---------|
| `SlotPicker` | Date/time slot selection with 8-min hold timer, availability indicators |
| `SlotDetailPanel` | Slot detail modal: edit/delete (available), join/reschedule (booked) |
| `EditSlotModal` | Edit slot date/time/price/subject |
| `ProposeRescheduleModal` | Tutor proposes new time with optional chat message |
| `TutorCalendar` | FullCalendar week/month view (dynamically loaded) |
| `Whiteboard` | Fabric.js collaborative canvas with Socket.IO sync |
| `MapView` | Leaflet map for location-based tutor search |
| `AnalyticsCharts` | Recharts bar/line charts (dynamically loaded) |
| `TutorCard` | Search result card with rating, price, subjects |
| `Avatar` | Profile photo with initials fallback on error |
| `DashboardLayout` | Sidebar nav with role-based menu + route prefetching |
| `StarRating` | 5-star rating display/input |

### 3.4 Performance Optimizations

- **Turbopack** dev server (`next dev --turbo`) gives 10x faster HMR
- **Dynamic imports** for heavy libraries (Recharts, FullCalendar, Socket.IO)
- **Route prefetching** in DashboardLayout for most-visited pages per role
- **Loading skeletons** (9 loading.tsx files) for instant navigation feedback
- **Image optimization** disabled for avatars (`unoptimized` flag) to avoid proxy issues
- **Static proxy** rewrite: `/static/*` proxied to Flask for local file serving

### 3.5 Next.js Configuration

- **Rewrites**: `/api/*` and `/static/*` proxy to Flask :5001
- **Security headers**: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy
- **Image remote patterns**: Cloudflare R2 + localhost:5001
- **Sentry**: Disabled in dev (v10 startup crash)

---

## 4. Concurrency

### 4.1 Booking holds

Prevents two students from booking the same slot at once.

```
Student A selects slot → Redis SETNX hold (8 min TTL) → slot locked
Student B selects slot → SETNX fails → "Slot being booked by another student"
Student A completes payment → PostgreSQL FOR UPDATE → booking confirmed → hold released
Student A abandons → TTL expires → slot available again
```

**Implementation**: `services/booking_hold_service.py`
- Redis SETNX for atomicity (production)
- Thread-safe in-memory dict fallback (development)
- Same-student refresh (re-selecting extends TTL)
- Automatic cleanup on payment success/failure

### 4.2 Row-level lock

`booking_service.create_booking()` does `TutorSlot.query.with_for_update().get(slot_id)`. Second line of defence behind the Redis hold.

---

## 5. Security

### 5.1 Authentication

| Feature | Implementation |
|---------|---------------|
| Password hashing | Werkzeug (SHA256 + salt) |
| Password requirements | 8+ chars, upper/lower/digit/special |
| Session storage | Redis (prod), filesystem (dev) |
| Session cookie | HttpOnly, Secure (prod), SameSite=Lax |
| Remember-me | 30-day persistent session |
| Account lockout | 5 failed attempts → 15-min lock |
| User caching | Redis `tw:user:{uid}` (300s TTL) |

### 5.2 Authorization

- Role-based decorators: `@_role_required('student')`, `@_tutor_required`
- Frontend middleware redirects unauthenticated users to `/login`
- Guardian approval required for minor bookings
- Admin roles: reviewer, verification_officer, admin, superadmin

### 5.3 Data Protection

| Data | Protection |
|------|-----------|
| Guardian phone | Fernet field encryption |
| Student home address | Fernet field encryption |
| Tutor documents | Per-file Fernet key, encrypted in R2 |
| Session recordings | Per-file encryption, 30-day retention |
| Document hashes | SHA-256 verification |

### 5.4 Rate Limiting

- Default: 200 requests/hour
- Login: 10 per 15 minutes
- Wallet top-up: 10/hour
- Document upload: 10/hour
- Backend: Flask-Limiter with Redis storage

### 5.5 Security Headers

CSP, HSTS (63072000s), X-Frame-Options (SAMEORIGIN), X-Content-Type-Options (nosniff), Referrer-Policy (strict-origin-when-cross-origin), Permissions-Policy

---

## 6. Third-Party Integrations

### 6.1 Stripe (Payments)

- **Checkout Sessions** for one-time booking payments
- **Platform fee**: 15% of session price
- **Stripe Connect** for tutor payout accounts
- **Refund processing**: Full or partial via API
- **Webhook**: `checkout.session.completed` confirms payment

### 6.2 Jitsi (Video Sessions)

- Room names generated per slot: `tw-{slot_id}-{uuid8}`
- WebRTC video/audio with screen share
- Embedded via Jitsi External API SDK
- Recording consent flow before session start

### 6.3 Cloudflare R2 (File Storage)

- S3-compatible API (boto3)
- Stores: avatars, documents, recordings, whiteboard snapshots, assignment files
- Per-file encryption with Fernet keys stored in database
- 90-day document retention with automatic cleanup

### 6.4 Resend.com (Email)

- 3,000 emails/month (free tier)
- Templates: booking confirmation, tutor notification, guardian alerts, password reset, verification, reminders
- Tracked via EmailNotification model

### 6.5 Socket.IO (Real-time)

- Chat message delivery/read status
- Whiteboard collaborative drawing (path sync, clear, undo)
- Redis message queue for cross-replica broadcast

### 6.6 OpenStreetMap / Nominatim (Geocoding)

- Forward geocoding (address to coordinates)
- Reverse geocoding (coordinates to address)
- Used for tutor search by location

### 6.7 OpenAI (Chatbot)

- AI assistant integration in frontend
- Learning-related Q&A

---

## 7. Infrastructure

### 7.1 Docker Services

| Service | Image | Purpose |
|---------|-------|---------|
| nginx | 1.25-alpine | API gateway, load balancer |
| postgres | postgis/postgis:15-3.4 | Database (max_connections=200, shared_buffers=256MB) |
| pgbouncer | edoburu/pgbouncer:1.21.0 | Connection pooling (50 per pool) |
| redis | redis:7-alpine | Cache, sessions, pub/sub (512MB, LRU eviction) |
| core-service | python:3.12-slim | Flask app (3 replicas, 1GB RAM, 1 CPU each) |
| search-service | python:3.12-slim | Tutor search microservice |
| chat-service | python:3.12-slim | Real-time messaging |
| learning-service | python:3.12-slim | Assignments & progress |
| notification-service | python:3.12-slim | Email & in-app notifications |

### 7.2 Database Migrations

26+ migrations covering: initial schema, location features, account lockout, chat features, recordings, learning goals, reschedule system, documents, assignments, session notes, wallet/payment, full-text search, performance indexes.

### 7.3 Deployment

- **Backend**: Docker on AWS/GCP/DigitalOcean with Gunicorn + gevent
- **Frontend**: Vercel (Next.js optimized)
- **Database**: AWS RDS PostgreSQL + PostGIS or self-managed
- **Cache**: Upstash Redis (serverless)
- **Storage**: Cloudflare R2
- **Monitoring**: Sentry (errors), `/health` endpoint (DB + Redis status), audit logs

---

## 8. Refund Policy

| Cancellation time | Refund |
|-------------------|--------|
| > 24 hours before session | 100% |
| 12-24 hours before | 50% |
| < 12 hours before | 0% |
| Tutor-initiated reschedule (student declines) | 100% |
| Admin override | Custom % |

---

## 9. Features

### Students
- Search tutors (text, filters, map, recommendations)
- Book sessions (hold + pay + guardian approval for minors)
- Live video sessions with Jitsi
- Collaborative whiteboard
- Chat messaging with tutors
- Assignments with submission and grading
- Learning goals with progress tracking
- Session recordings (with consent)
- Wallet with top-up and transaction history
- Reschedule requests (2 max per booking)
- Review tutors (5-star with dimension ratings)
- Favorite tutors and saved locations

### Tutors
- Profile with verification workflow
- Availability management (one-off + recurring slots)
- Calendar view (FullCalendar)
- Earnings dashboard with charts
- Student management
- Assignment creation with rubrics
- Session notes (private + shared)
- Stripe Connect payouts
- Reschedule proposals with chat messaging
- Review responses

### Admins
- User management (suspend/verify/view)
- Tutor verification queue
- Booking oversight
- Revenue analytics (charts)
- Content moderation
- Recording management
- Audit logging
- Platform settings

### Guardians
- Link and manage children (minors)
- Approve/reject bookings
- Spending limits (weekly/monthly)
- Activity tracking
- Messages with tutors
- Reschedule approvals
