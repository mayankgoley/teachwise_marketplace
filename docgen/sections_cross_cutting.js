const { buildSection, h1, h2, h3, h4, para, txt, bullet, numItem, codeBlock, makeTable, infoBox, funcBlock, spacer, C } = require("./generate_code_reference");

const sections = [];

// ═══════════════════════════════════════════════════════
// SECTION A: Cross-Cutting Concerns
// ═══════════════════════════════════════════════════════
sections.push(buildSection("Cross-Cutting Concerns", [
  h1("Section A: Cross-Cutting Concerns"),

  h2("A.1 Authentication Flow — End to End"),
  para("Tracing a tutor login request from HTTP hit to session cookie:"),
  numItem("Browser POSTs to /tutor/login with email + password (rate limited: 10 per 15 min by Flask-Limiter)."),
  numItem("tutor_routes.login() receives the request. Queries Tutor.query.filter_by(email=email).first()."),
  numItem("is_account_locked(tutor) checks locked_until. If locked, flashes error and redirects. If lock expired, auto-resets via db.session.commit()."),
  numItem("check_password_hash(tutor.password, password) validates bcrypt hash."),
  numItem("On failure: increment_failed_login(tutor) bumps count, sets locked_until at threshold 5 (db.session.commit()). Flash and redirect."),
  numItem("On success: reset_failed_login(tutor) zeroes counter (db.session.commit()). login_user(tutor) creates Flask-Login session."),
  numItem("JWT creation: create_jwt_token(uid=tutor.get_id(), role='tutor', name=tutor.name, email=tutor.email) generates HS256 token with 24h expiry using JWT_SECRET_KEY."),
  numItem("Response sets cookie 'tw_jwt' (httponly, samesite=Lax, max_age=86400) and redirects to /tutor/dashboard."),
  numItem("Subsequent requests: Flask-Login checks session. Microservice calls use JWT from cookie via get_jwt_from_request()."),
  infoBox("The JWT cookie has secure=False — must be True in production (HTTPS). Student and guardian login follow the same pattern in their respective route files.", "warning"),

  h2("A.2 Booking Flow — End to End"),
  para("Complete booking lifecycle from slot selection to session completion:"),
  numItem("Student views /tutor/<tutor_id> (view_tutor_profile). Available slots queried: pending status, future date, group not full."),
  numItem("Student clicks 'Book' → POST /book/<slot_id> (book_session in tutor_routes.py)."),
  numItem("Validation: auth check → email verified → guardian verified (if minor) → time conflict check → slot availability."),
  numItem("Row lock: TutorSlot.query.with_for_update().get(slot_id). Updates status to 'booked', sets student_id. For groups: increments current_students."),
  numItem("Cache invalidated: cache_delete_pattern('search:*') and cache_delete_pattern('rec:*')."),
  numItem("Jitsi room generated for online sessions: generate_room_name(slot_id) → e.g., 'tw-42-a1b2c3d4'."),
  numItem("If in-person: meeting location saved, encrypted if home address, optionally saved to StudentSavedLocation."),
  numItem("If price > 0: Booking.status set to 'Pending Payment'. Redirect to /payment/checkout/<booking_id>."),
  numItem("Price breakdown shown (payment_checkout). Student clicks Proceed → POST to payment_checkout_proceed."),
  numItem("create_checkout_session(): Payment record created (pending), Stripe Checkout Session created with application_fee_amount for Connect."),
  numItem("Student redirected to Stripe. After payment, Stripe fires webhook to /payment/webhook."),
  numItem("stripe_webhook(): Verifies signature, calls process_successful_payment() → Payment.status='completed', Booking.status='Confirmed'."),
  numItem("Confirmation emails sent to student and tutor. publish_event('payment.completed', ...) for notification service."),
  numItem("If minor: guardian_booking_alert email sent, booking.guardian_notified=True."),
  numItem("Scheduler: check_reminders() sends 24h and 1h reminders before session."),
  numItem("Session goes live in /session-room/<slot_id> (Jitsi embedded iframe)."),
  numItem("After session: slot status → 'completed', tutor payout already handled by Stripe Connect auto-transfer."),
  infoBox("If Stripe Connect is not set up for the tutor, all funds go to the platform account. The platform must manually transfer the tutor_payout amount.", "warning"),

  h2("A.3 Payment Flow — End to End"),
  para("Detailed payment flow with all function references:"),
  numItem("create_checkout_session(booking, slot, student, tutor) [payment_service.py]: Calculates amount_cents and platform_fee_cents from slot.price and PLATFORM_FEE_PERCENT (15%)."),
  numItem("Creates Payment record: amount=slot.price, platform_fee, tutor_payout=price*(1-fee%). DB flush to get payment.id."),
  numItem("Builds Stripe checkout params: line_items, success/cancel URLs, customer_email, metadata (booking_id, payment_id)."),
  numItem("If tutor has Stripe Connect: adds payment_intent_data.application_fee_amount and transfer_data.destination."),
  numItem("stripe.checkout.Session.create() called. Session ID saved to Payment record. Committed."),
  numItem("Student pays on Stripe → checkout.session.completed webhook fires."),
  numItem("process_successful_payment(checkout_session_id): Retrieves Stripe session, sets payment_intent_id, status='completed', booking.status='Confirmed'."),
  numItem("Refund path: calculate_refund_percentage(slot) returns 100/50/0 based on hours until session."),
  numItem("process_refund(payment_id, refund_percent): stripe.Refund.create with calculated amount. Updates Payment record."),
  numItem("Self-service refund: request_refund() creates RefundRequest (pending). Admin reviews and approves/denies."),

  h2("A.4 Real-Time Events Map"),
  makeTable(["Event Name", "Published By", "Channel", "Payload", "What It Triggers"], [
    ["booking.created", "create_booking() in booking_service.py", "tw:events", "{booking_id, student_id, tutor_id, slot_id, student_name, date, start_time, mode}", "Notification service creates in-app notification"],
    ["booking.cancelled", "cancel_booking() in booking_service.py", "tw:events", "{booking_id, student_id, tutor_id, slot_id, cancelled_by, refund_pct}", "Notification service creates cancellation notification"],
    ["payment.completed", "stripe_webhook() in payment_routes.py", "tw:events", "{payment_id, booking_id, student_id, tutor_id, amount, student_name, tutor_name}", "Notification service creates payment confirmation"],
  ], [1600, 2000, 1000, 2400, 2360]),

  h2("A.5 Celery Task Inventory"),
  makeTable(["Task Name", "File", "Trigger", "Retry Policy", "Rate Limit", "What It Does"], [
    ["send_email_task", "services/tasks/email_tasks.py", "send_email() in email_service.py", "3 retries, exponential backoff (30s * 2^n)", "100/min", "Sends email via Resend API, logs to email_notifications table"],
  ], [1600, 2200, 2000, 1600, 800, 1160]),

  h2("A.6 Scheduled Jobs Inventory"),
  makeTable(["Job Name", "Schedule", "What It Does", "What It Modifies", "If It Fails"], [
    ["session_reminders", "Every 15 min", "Sends 24h/1h email reminders for booked slots", "TutorSlot.reminder_24h_sent, reminder_1h_sent", "Reminders delayed until next run"],
    ["document_cleanup", "Daily 3 AM", "Deletes R2 files for docs past retention period", "TutorDocument.file_deleted = True", "Files accumulate in R2, no user impact"],
    ["reschedule_expiry", "Every 1 hour", "Expires pending reschedule requests past 48h", "RescheduleRequest.status = 'expired'", "Requests stay pending indefinitely"],
    ["overdue_assignments", "Daily 8 AM", "Marks past-due assignments as overdue", "Assignment.status = 'overdue'", "Assignments show wrong status"],
    ["recording_cleanup", "Daily 4 AM", "Deletes R2 recordings past their expires_at", "SessionRecording.is_deleted = True", "Expired recordings remain accessible"],
  ], [1600, 1200, 2400, 2400, 1760]),

  h2("A.7 Encryption Map"),
  makeTable(["Model", "Field", "Method", "Encrypted At", "Decrypted At", "Key Source", "Risk If Key Lost"], [
    ["Guardian", "_phone_encrypted", "Fernet (FERNET_KEY)", "phone setter", "phone getter", "FERNET_KEY env var", "Phone numbers show '[encrypted]'"],
    ["TutorDocument", "file_encryption_key", "Fernet (master encrypts per-file key)", "upload_document()", "download_document()", "FERNET_KEY", "Documents permanently inaccessible"],
    ["Booking", "meeting_address_encrypted", "Fernet (FERNET_KEY)", "book_session() for home addresses", "Session room template", "FERNET_KEY", "Home addresses lost"],
    ["SessionRecording", "file_encryption_key", "Fernet (master encrypts per-file key)", "Recording save", "Recording playback", "FERNET_KEY", "Recordings permanently inaccessible"],
    ["WhiteboardSession", "snapshots[].encryption_key", "Fernet (per-snapshot key)", "Whiteboard snapshot save", "Whiteboard snapshot view", "FERNET_KEY", "Snapshots lost"],
    ["SessionNote", "attachments[].encryption_key", "Fernet (per-attachment key)", "Note attachment upload", "Note attachment download", "FERNET_KEY", "Attachments lost"],
  ], [1400, 1600, 1400, 1200, 1200, 1200, 1360]),

  h2("A.8 External API Call Inventory"),
  makeTable(["File", "Function", "Service", "Endpoint/Method", "Retry", "Timeout", "Error Handling"], [
    ["payment_service.py", "create_checkout_session", "Stripe", "checkout.Session.create", "No", "Stripe default", "Exception re-raised to caller"],
    ["payment_service.py", "process_successful_payment", "Stripe", "checkout.Session.retrieve", "No", "Stripe default", "Exception propagates"],
    ["payment_service.py", "process_refund", "Stripe", "Refund.create", "No", "Stripe default", "StripeError caught, returns None"],
    ["payment_service.py", "create_connect_account_link", "Stripe", "Account.create + AccountLink.create", "No", "Stripe default", "Exception propagates"],
    ["payment_routes.py", "stripe_callback", "Stripe", "Account.retrieve", "No", "Stripe default", "Exception caught, flash error"],
    ["email_tasks.py", "send_email_task", "Resend", "Emails.send", "3 retries (30/60/120s)", "Resend default", "Retry on any exception"],
    ["email_service.py", "_send_email_sync", "Resend", "Emails.send", "No", "Resend default", "Exception caught, status='failed'"],
    ["service_client.py", "_request", "Internal services", "HTTP GET/POST", "2 retries (0.5/1/2s)", "3s", "Circuit breaker, returns None"],
    ["geocoding_service.py", "geocode_and_save", "External geocoding", "HTTP request", "No", "Unknown", "Exception caught by callers"],
  ], [1400, 1600, 1000, 1600, 1200, 1000, 1560]),
]));

// ═══════════════════════════════════════════════════════
// SECTION B: Security Review
// ═══════════════════════════════════════════════════════
sections.push(buildSection("Security Review", [
  h1("Section B: Security Review"),

  h2("B.1 Input Validation Coverage"),
  makeTable(["Route / Endpoint", "Validator Used", "Fields Validated", "Fields NOT Validated", "Risk"], [
    ["tutor/register", "validate_password_complexity, sanitize_input_length", "password, name, subject", "email format (only checked for uniqueness), experience (raw int())", "Low"],
    ["tutor/edit-profile", "sanitize_input_length", "bio, qualification, institution, address", "hourly_rate (only float(), no max), teaching_mode (whitelist ok)", "Low"],
    ["tutor/upload-photo", "Extension + magic bytes + size", "File type and size", "—", "Low"],
    ["book_session", "Auth + conflict + slot availability", "Student eligibility, time conflicts", "meeting_latitude/longitude (accepts any float)", "Medium"],
    ["stripe_webhook", "Stripe signature verification", "Event authenticity", "—", "Low"],
    ["tutor/add-slot", "sanitize_input_length on subject", "subject text", "price (no max), date (no past check), time (no validation end > start)", "Medium"],
    ["review/report", "Whitelist for reason", "reason field", "details (only truncated to 500, not sanitized)", "Low"],
    ["request_refund", "Auth + payment status check", "Payment ownership", "reason (not sanitized, only .strip())", "Low"],
  ], [1600, 1800, 1600, 2200, 800]),

  h2("B.2 Authentication & Authorization Gaps"),
  bullet("stripe_webhook: No @login_required (correct — Stripe signature verification is used instead)."),
  bullet("view_tutor_profile: No @login_required (correct — public page). But is_favorited check accesses current_user.id without checking user_type — could error for admin users."),
  bullet("book_session: Checks current_user.user_type but does not use @role_required. Manual auth checks are present but verbose."),
  bullet("category: No @login_required (correct — public page). Uses ilike with user-supplied subject parameter — potential for SQL injection via ilike pattern characters (%, _) but not actual injection."),
  bullet("payment_cancel: Only checks booking.status == 'Pending Payment' — no explicit student ownership check. The booking could belong to anyone."),
  infoBox("payment_cancel does not verify that current_user is the booking owner. Any authenticated user who knows the booking_id could cancel another user's pending payment.", "danger"),

  h2("B.3 Rate Limiting Coverage"),
  makeTable(["Route", "Rate Limit", "At Limit", "Routes Missing Rate Limits"], [
    ["tutor/register POST", "5/hour", "429 Too Many Requests", "—"],
    ["tutor/login POST", "10/15min", "429", "—"],
    ["tutor/forgot-password POST", "3/hour", "429", "—"],
    ["tutor/reset-password POST", "3/hour", "429", "—"],
    ["book_session POST", "20/hour", "429", "—"],
    ["Global default", "200/hour", "429", "—"],
  ], [2200, 1600, 1600, 3960]),
  para("Routes that should have stricter rate limits but don't:"),
  bullet("payment/retry — no specific limit beyond global. Could be abused to create many pending bookings."),
  bullet("tutor/upload-photo — no specific limit. Could be used for storage abuse."),
  bullet("review/vote and review/report — use global limit only. Could be toggled rapidly."),

  h2("B.4 SQL Injection & Injection Risks"),
  bullet("search_service.py uses raw SQL text() for full-text search: text(\"search_vector @@ to_tsquery('english', :q)\") — parameterized, SAFE."),
  bullet("category route uses ilike(f'%{subject}%') — the subject comes from URL path, not query. SQLAlchemy ilike parameterizes this, SAFE."),
  bullet("tutor_students route uses ilike(f'%{q}%') where q comes from request.args — parameterized by SQLAlchemy, SAFE."),
  infoBox("No raw SQL injection vulnerabilities found. All user input passes through SQLAlchemy's parameterized queries.", "success"),

  h2("B.5 File Upload Security"),
  makeTable(["Endpoint", "Allowed Types", "Size Limit", "Filename Sanitized", "Magic Bytes Check", "Scanned"], [
    ["tutor/upload-photo", "jpg, jpeg, png", "2 MB", "UUID-based path (no original filename)", "Yes (JPEG, PNG)", "No"],
    ["tutor/documents (admin routes)", "pdf, jpg, jpeg, png", "5 MB (DOC_MAX_SIZE_MB)", "UUID-based path", "No (TODO)", "No"],
    ["Chat file uploads", "Configured per-route", "10 MB global", "Varies", "No", "No"],
  ], [1600, 1400, 1000, 2000, 1400, 960]),
  infoBox("Document uploads lack magic byte validation — a file with a .pdf extension but containing malware would be accepted. Consider adding magic byte checks for documents.", "warning"),

  h2("B.6 Sensitive Data Handling"),
  bullet("Passwords: Stored as bcrypt hashes via werkzeug.security.generate_password_hash. Never logged or returned in responses."),
  bullet("Stripe keys: Read from environment variables. Not logged. stripe.api_key set globally — affects all Stripe calls."),
  bullet("FERNET_KEY: Read from environment. TestConfig has a hardcoded test key (acceptable for tests)."),
  bullet("Guardian phone: Encrypted in DB via Fernet. Decryption failure returns '[encrypted]' string — safe."),
  bullet("Meeting addresses (home): Encrypted via encrypt_field() when location_type is 'home'. Plain text for other types."),
  bullet("JWT tokens: Logged? No — only event types and email addresses appear in logs."),
  bullet("register route: Exception flash(f'Error: {e}') may leak internal error details to user."),
  infoBox("The register route's bare except displays exception messages to users. An attacker could trigger specific errors to probe the system. Use a generic error message instead.", "warning"),
]));

// ═══════════════════════════════════════════════════════
// SECTION C: Performance Hotspots
// ═══════════════════════════════════════════════════════
sections.push(buildSection("Performance Hotspots", [
  h1("Section C: Performance Hotspots"),

  h2("C.1 N+1 Query Risk Map"),
  makeTable(["File", "Function", "Issue", "Impact", "Fix"], [
    ["tutor_routes.py", "tutor_earnings()", "Loops all payments, does Booking.query.get + TutorSlot.query.get per payment", "O(n) queries for n payments", "Single joined query: Payment.query.join(Booking).join(TutorSlot)"],
    ["tutor_routes.py", "earnings_export()", "Same N+1 as tutor_earnings + Student.query.get per payment", "O(2n) queries", "Joined query with Student"],
    ["tutor_routes.py", "tutor_dashboard()", "Loads ALL completed bookings + ALL payments for monthly aggregation", "Full table scan for active tutors", "Use SQL aggregation: GROUP BY month"],
    ["notification_service.py", "get_student_notifications()", "Queries Booking, then TutorSlot per booking, then Tutor per slot", "Multiple rounds", "Batch-loads tutors (partially optimized)"],
    ["recommendation_service.py", "get_recommended_tutors()", "Loads ALL verified tutors on cache miss", "Full table load", "Paginate or use DB-side scoring"],
    ["scheduler_service.py", "check_reminders()", "Batch-loads tutors and students (OPTIMIZED)", "Good pattern", "Already efficient"],
  ], [1600, 1800, 2400, 1200, 2360]),

  h2("C.2 Missing Database Indexes"),
  makeTable(["Table", "Column(s)", "Query Pattern", "Suggested Index"], [
    ["bookings", "student_id + status", "Booking.query.filter_by(student_id=X, status='Booked')", "CREATE INDEX ix_bookings_student_status ON bookings(student_id, status)"],
    ["bookings", "tutor_id + status", "Booking.query.filter_by(tutor_id=X, status='Completed')", "CREATE INDEX ix_bookings_tutor_status ON bookings(tutor_id, status)"],
    ["tutor_slots", "tutor_id + status + date", "TutorSlot.query.filter(tutor_id, status='pending', date>=today)", "CREATE INDEX ix_slots_tutor_status_date ON tutor_slots(tutor_id, status, date)"],
    ["payments", "tutor_id + status", "Payment.query.filter_by(tutor_id=X, status='completed')", "CREATE INDEX ix_payments_tutor_status ON payments(tutor_id, status)"],
    ["payments", "stripe_checkout_session_id", "Payment.query.filter_by(stripe_checkout_session_id=X)", "CREATE UNIQUE INDEX ix_payments_stripe_session ON payments(stripe_checkout_session_id)"],
    ["email_notifications", "recipient_email + email_type", "Queried for notification preference checking", "CREATE INDEX ix_email_notif_recipient ON email_notifications(recipient_email)"],
    ["in_app_notifications", "user_id + user_type", "Frequent queries for notification dropdown", "CREATE INDEX ix_notif_user ON in_app_notifications(user_id, user_type, created_at DESC)"],
  ], [1800, 2200, 2600, 2760]),

  h2("C.3 Redis Cache Coverage"),
  makeTable(["Data Type", "Cached?", "Key Pattern", "TTL", "Invalidation Trigger", "Stale Risk"], [
    ["Search results", "Yes", "search:{hash}", "900s (15 min)", "invalidate_search_cache()", "Low — profile/slot changes trigger invalidation"],
    ["Recommendations", "Yes", "rec:{subject}:{lat}:{lng}", "3600s (1 hour)", "cache_delete_pattern('rec:*') on booking", "Medium — new tutors not shown for up to 1 hour"],
    ["Tutor profile data", "No", "—", "—", "—", "N/A — always fresh from DB"],
    ["Slot availability", "No", "—", "—", "—", "N/A — always fresh from DB (critical for booking)"],
    ["User sessions", "Optional", "tw:session:*", "30 days", "Logout", "Low"],
  ], [1600, 800, 1800, 1000, 2200, 1960]),

  h2("C.4 Heavy Routes"),
  makeTable(["Route", "What Makes It Heavy", "DB Queries (approx)", "Optimization"], [
    ["tutor_dashboard", "Loads ALL slots + ALL reviews + ALL bookings + ALL payments + profile completion (slot check) + expiring docs", "8-12", "Use SQL aggregation, limit to recent data"],
    ["view_tutor_profile", "All reviews + paginated reviews + all reviews (averages) + favorite check + similar tutors + user votes", "6-8", "Cache review aggregates; compute dim_avgs in SQL"],
    ["tutor_earnings", "All payments + per-payment Booking + TutorSlot lookup", "1 + 2n", "Single joined query"],
    ["tutor_students", "Distinct student IDs + students + session counts + recent sessions + distinct subjects", "5-6", "Reasonable — well-structured subqueries"],
    ["get_recommended_tutors (cache miss)", "All verified tutors + batch slot counts", "2", "OK for <1000 tutors; needs pagination beyond that"],
  ], [1800, 2800, 1200, 3560]),
]));

// ═══════════════════════════════════════════════════════
// SECTION D: Developer Quick Reference
// ═══════════════════════════════════════════════════════
sections.push(buildSection("Developer Quick Reference", [
  h1("Section D: Developer Quick Reference"),

  h2("D.1 Adding a New Route — Checklist"),
  numItem("Create the route function in the appropriate Blueprint file (routes/{role}_routes.py)."),
  numItem("Add @role_required('role') or @login_required decorator as appropriate."),
  numItem("Add rate limiting with @limiter.limit() for POST endpoints, especially auth and create operations."),
  numItem("Sanitize all user input using sanitize_text() or sanitize_input_length() from utils/sanitizer.py."),
  numItem("Validate structured input (email, password, dates) using functions from utils/validators.py."),
  numItem("Use db.session.commit() with try/except and db.session.rollback() for write operations."),
  numItem("Create or update the HTML template in templates/."),
  numItem("If the route affects tutor profiles or slots, call invalidate_search_cache() after changes."),
  numItem("Add appropriate flash messages for user feedback."),
  numItem("Write tests in the corresponding test file."),

  h2("D.2 Adding a New Model — Checklist"),
  numItem("Create models/new_model.py with class inheriting from db.Model."),
  numItem("Define __tablename__, columns, relationships, and any computed properties."),
  numItem("Add the import to models/__init__.py."),
  numItem("Create an Alembic migration: flask db migrate -m 'Add new_model table'."),
  numItem("Review the migration file, then apply: flask db upgrade."),
  numItem("If the model has encrypted fields, use encrypt_field()/decrypt_field() from encryption_service."),
  numItem("If the model has JSON columns, use default=list or default=lambda: {} for mutable defaults."),
  numItem("Add a __repr__ method for debugging."),

  h2("D.3 Adding a New Email Template — Checklist"),
  numItem("Add a new function in services/email_service.py: def email_new_type(params): return (subject, html)."),
  numItem("Use the STYLE and BTN constants for consistent formatting."),
  numItem("If the email should respect notification preferences, add a mapping in EMAIL_TYPE_PREF_MAP."),
  numItem("Call it via: send_email(to, subject, html, 'email_type', 'recipient_type', booking_id=optional)."),
  numItem("Test with Celery running (async path) and without (sync fallback)."),

  h2("D.4 Adding a New Celery Task — Checklist"),
  numItem("Create the task in services/tasks/ (or existing file if related)."),
  numItem("Import celery from celery_app."),
  numItem("Use @celery.task(bind=True, name='full.dotted.name', max_retries=3, acks_late=True)."),
  numItem("Inside the task, create Flask app context: from app import app; with app.app_context(): ..."),
  numItem("Use self.retry(exc=exc, countdown=delay) for retryable failures."),
  numItem("Add task routing in celery_app.py task_routes if it needs a dedicated queue."),
  numItem("Test: celery -A celery_app.celery worker --loglevel=info -Q default,email"),

  h2("D.5 Adding a New Background Scheduled Job — Checklist"),
  numItem("Add a function in services/scheduler_service.py: def new_job(app): with app.app_context(): ..."),
  numItem("Register it in init_scheduler() with scheduler.add_job()."),
  numItem("Choose trigger: 'interval' (minutes/hours) or 'cron' (hour/minute)."),
  numItem("Always use replace_existing=True and a unique job id."),
  numItem("Add a safety limit (.limit(N)) to queries to prevent runaway processing."),
  numItem("Log the outcome: how many records processed."),

  h2("D.6 Common Code Patterns"),

  h3("Pattern 1: Cache-Aside with Redis"),
  codeBlock([
    "from services.cache_service import cache_get, cache_set",
    "",
    "cache_key = f'my_data:{param}'",
    "cached = cache_get(cache_key)",
    "if cached:",
    "    return cached",
    "",
    "# Compute fresh data",
    "data = expensive_query()",
    "cache_set(cache_key, data, ttl=900)  # 15 min default",
    "return data",
  ]),

  h3("Pattern 2: Role-Protected Route"),
  codeBlock([
    "@bp.route('/path', methods=['GET', 'POST'])",
    "@role_required('tutor')  # includes @login_required",
    "def my_route():",
    "    tutor = current_user",
    "    # ... route logic ...",
  ]),

  h3("Pattern 3: Safe DB Write with Rollback"),
  codeBlock([
    "try:",
    "    record.field = new_value",
    "    db.session.commit()",
    "    flash('Success!', 'success')",
    "except Exception as e:",
    "    db.session.rollback()",
    "    current_app.logger.error(f'Error: {e}')",
    "    flash('An error occurred.', 'danger')",
  ]),

  h3("Pattern 4: Stripe Error Handling"),
  codeBlock([
    "try:",
    "    result = stripe.SomeApi.method(...)",
    "    db.session.commit()",
    "    return result",
    "except stripe.error.StripeError as e:",
    "    db.session.rollback()",
    "    current_app.logger.error(f'Stripe error: {e}')",
    "    return None",
  ]),

  h3("Pattern 5: Event Publishing (Fire and Forget)"),
  codeBlock([
    "try:",
    "    from shared.event_bus import publish_event",
    "    publish_event('entity.action', {",
    "        'entity_id': record.id,",
    "        'key_data': value,",
    "    })",
    "except Exception as e:",
    "    current_app.logger.warning(f'Event publish error: {e}')",
    "    # Never let event failure block the main operation",
  ]),

  h3("Pattern 6: Encrypted File Upload"),
  codeBlock([
    "from services.storage_service import upload_document",
    "",
    "result = upload_document(file_bytes, tutor_id, filename)",
    "if result:",
    "    record.r2_object_key = result['r2_object_key']",
    "    record.file_encryption_key = result['file_encryption_key']",
    "    record.verification_hash = result['verification_hash']",
    "    db.session.commit()",
  ]),
]));

module.exports = sections;
