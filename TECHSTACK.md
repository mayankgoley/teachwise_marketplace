# TeachWise - Tech Stack

## Architecture Overview

TeachWise uses a microservice architecture with an Nginx API gateway, PostgreSQL database, Redis cache, and containerized deployment via Docker.

**Services:**
| Service | Replicas | Purpose |
|---------|----------|---------|
| core-service | 3 | Auth, booking, payments, wallet, admin |
| search-service | 2 | Tutor search, recommendations |
| chat-service | 2 | Real-time messaging (WebSocket) |
| learning-service | 1 | Assignments, notes, progress tracking |
| notification-service | 1 | Bell notifications, notification center |
| celery_worker | 1 | Background email tasks |

**Infrastructure:**
| Component | Port | Role |
|-----------|------|------|
| Nginx | 80 | API gateway, static files, path-based routing |
| PostgreSQL 15 | 5432 | Primary data store |
| PgBouncer | 6432 | Connection pooler (transaction mode, max 1000) |
| Redis | 6379 | Cache, sessions, pub/sub, Celery broker |

---

## Backend

### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| Flask | 2.3.3 | Web framework |
| Flask-SQLAlchemy | 3.0.5 | ORM |
| Flask-Migrate | 4.0.5 | Database migrations (Alembic) |
| Flask-Login | 0.6.3 | Session management (student, tutor, admin, guardian) |
| Werkzeug | 2.3.7 | Password hashing, HTTP utilities |
| psycopg2-binary | 2.9.7 | PostgreSQL driver |
| python-dotenv | 1.0.0 | Environment variable loading |

### Security
| Package | Version | Purpose |
|---------|---------|---------|
| Flask-WTF | 1.2.1 | CSRF protection |
| Flask-Limiter | 3.5.1 | Rate limiting (brute-force protection) |
| cryptography | 42.0.5 | Fernet encryption for sensitive fields |
| itsdangerous | 2.1.2 | Signed tokens for email verification |
| bleach | 6.1.0 | HTML sanitization |
| PyJWT | 2.8.0 | JWT for microservice auth |

### Real-Time & Concurrency
| Package | Version | Purpose |
|---------|---------|---------|
| Flask-SocketIO | - | WebSocket with SocketIO |
| gevent | 24.2.1 | Coroutine-based concurrency |
| gevent-websocket | 0.10.1 | WebSocket support for gevent |
| Flask-Session | 0.8.0 | Server-side sessions (Redis backend) |

### Background Processing
| Package | Version | Purpose |
|---------|---------|---------|
| celery[redis] | 5.4.0 | Distributed task queue (email sending) |
| APScheduler | 3.10.4 | Session reminder scheduler (24h + 1h before) |

### Third-Party Integrations
| Package | Version | Service |
|---------|---------|---------|
| stripe | 8.4.0 | Payments + Stripe Connect for tutor payouts |
| resend | 2.23.0 | Transactional email (3,000 free/month) |
| boto3 | 1.34.69 | Cloudflare R2 document storage (S3-compatible) |
| openai | 1.30+ | AI chatbot (GPT-4o with function calling) |
| python-magic | 0.4.27 | File type detection |
| requests | 2.31.0 | Inter-service HTTP calls |
| redis | 5.0.4 | Redis client (Upstash compatible) |

### Testing
| Package | Version | Purpose |
|---------|---------|---------|
| pytest | 8.1.1 | Test runner |
| pytest-cov | 5.0.0 | Code coverage |

---

## Frontend

### CSS & Styling
| Library | Method | Purpose |
|---------|--------|---------|
| Tailwind CSS | Local (tailwind.min.css) | Utility-first CSS framework |
| Inter (Google Fonts) | CDN | Primary typeface |
| FontAwesome | Local (fontawesome.min.css) | Icons |

### JavaScript Libraries
| Library | Method | Purpose |
|---------|--------|---------|
| Socket.IO Client | Local | Real-time chat and notifications |
| Leaflet.js | Local | Interactive maps for tutor search |
| Chart.js | Local | Progress tracking charts |
| FullCalendar | Local | Tutor slot calendar UI |
| Fabric.js | Local | Collaborative whiteboard canvas |

### Custom JS Modules
| File | Purpose |
|------|---------|
| main.js | Core app logic, mobile menu |
| socket.js | SocketIO event handlers |
| chatbot.js | AI chatbot widget |
| notifications.js | Real-time notification bell |
| toast.js | Flash message toasts |

### Template Engine
- **Jinja2** (Flask built-in) with 59 HTML templates
- Role-specific dashboards for student, tutor, admin, guardian

---

## Database

**Engine:** PostgreSQL 15 with PgBouncer connection pooling

**Pool config:** 15 connections, 30 max overflow, pre-ping enabled, 300s recycle

### Models (23 tables)
| Category | Models |
|----------|--------|
| Users | Student, Tutor, Admin, Guardian |
| Booking | Booking, TutorSlot, RescheduleRequest |
| Payments | Payment, Wallet, WalletTransaction |
| Messaging | Conversation, Message |
| AI | ChatbotConversation, ChatbotMessage |
| Learning | Assignment, Submission, SessionNote, LearningGoal, ProgressEntry |
| Social | Review, FavoriteTutor |
| Notifications | InAppNotification, EmailNotification |
| Documents | TutorDocument |
| Sessions | WhiteboardSession, SessionRecording |

---

## Inter-Service Communication

### REST (ServiceClient)
- JWT tokens (HS256, 60s expiry) for service-to-service auth
- Circuit breaker pattern (5 failures, 30s recovery)
- Retry with exponential backoff (2 retries)

### Event Bus (Redis Pub/Sub)
Channel: `tw:events`

Events: `booking.created`, `booking.cancelled`, `payment.completed`, `message.sent`, `assignment.submitted`, `assignment.graded`, `goal.completed`, `tutor.verified`, `review.created`

### Shared Modules (`/shared/`)
| File | Purpose |
|------|---------|
| event_bus.py | Redis pub/sub publish/subscribe |
| jwt_auth.py | JWT creation, validation, decorators |
| service_client.py | HTTP client with circuit breaker |

---

## Security

| Layer | Implementation |
|-------|---------------|
| Authentication | Flask-Login (web), JWT (microservices) |
| Authorization | Role-based (student, tutor, admin, guardian) |
| CSRF | Flask-WTF on all forms |
| Rate Limiting | Nginx (30r/s API, 5r/m login) + Flask-Limiter (200/hr default) |
| Password Hashing | Werkzeug (salted) |
| Account Lockout | 5 failed attempts, 15-minute lockout |
| Encryption | Fernet symmetric encryption for documents |
| Sessions | Server-side (Redis), signed, 30-day TTL |
| Headers | CSP, X-Frame-Options, HSTS, nosniff, XSS protection |
| Input Sanitization | bleach, WTF form validators |

---

## Caching (Redis)

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `tw:user:{uid}` | 5 min | User loader cache |
| `tw:session:*` | 30 days | Server-side sessions |
| `search:*` | 15 min | Search result cache |
| `rec:*` | 15 min | Recommendation cache |

Default TTL: 900s. LRU eviction at 512MB max memory.

---

## Deployment

### Docker
- **Base image:** Python 3.12-slim
- **System deps:** libpq-dev, gcc, libmagic1
- **App server:** Gunicorn + GeventWebSocketWorker
- **Workers:** 4 (configurable), 1500 connections each
- **Timeout:** 120s
- **Non-root user:** appuser

### Resource Limits
| Service | Memory | CPU |
|---------|--------|-----|
| core-service (x3) | 1G | 1.0 |
| search-service (x2) | 512M | 0.5 |
| chat-service (x2) | 512M | 0.5 |
| learning-service | 512M | 0.5 |
| notification-service | 256M | 0.25 |
| celery_worker | 512M | 0.5 |
| PostgreSQL | 1G | - |
| Redis | 640M | - |

### Nginx
- Path-based routing to upstream service groups
- IP-hash sticky sessions for stateful services (core, chat)
- Static file serving with 30-day cache and gzip compression
- WebSocket proxy for `/socket.io/`

---

## External Services

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| Stripe | Payments + Connect payouts | Test mode |
| Resend.com | Transactional email | 3,000/month |
| Cloudflare R2 | Document storage (S3-compatible) | 10GB |
| Upstash Redis | Managed Redis | 10,000 commands/day |
| Jitsi Meet | Video conferencing | Public instance |
| OpenStreetMap | Maps + Nominatim geocoding | Free |
| OpenAI | AI chatbot | Pay-per-use |
| Google Fonts | Inter typeface | Free |
