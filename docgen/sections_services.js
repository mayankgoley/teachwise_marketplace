const { buildSection, h1, h2, h3, h4, para, txt, bullet, codeBlock, makeTable, infoBox, funcBlock, spacer, C } = require("./generate_code_reference");

const sections = [];

// ═══════════════════════════════════════════════════════
// SECTION 3: services/payment_service.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("services/payment_service.py", [
  h1("3. payment_service.py (services/payment_service.py)"),
  h2("Overview"),
  para("Core Stripe integration layer. Handles Checkout Session creation (with Stripe Connect split payments), payment confirmation processing, refund execution, and Stripe Connect account onboarding for tutors. Every dollar that flows through TeachWise passes through this file."),

  h2("Dependencies"),
  makeTable(["Import", "Type", "Used For"], [
    ["stripe", "Third-party", "All Stripe API calls"],
    ["flask.current_app, url_for", "Third-party", "Config access, URL generation"],
    ["models.payment.Payment", "Internal", "Payment record CRUD"],
    ["database.db", "Internal", "SQLAlchemy session"],
    ["datetime", "stdlib", "Timestamps"],
  ], [3200, 1400, 4760]),

  h2("Constants & Configuration"),
  makeTable(["Config Key", "Source", "Default", "What It Controls"], [
    ["PLATFORM_FEE_PERCENT", "config.py", "15", "Percentage taken as platform fee on every payment"],
    ["STRIPE_SECRET_KEY", "env", "sk_test_placeholder", "Stripe API key — set automatically by stripe module"],
    ["STRIPE_WEBHOOK_SECRET", "env", "whsec_placeholder", "Verifies webhook signatures (used in payment_routes)"],
  ], [2200, 1400, 1800, 3960]),

  ...funcBlock(
    "create_checkout_session",
    "def create_checkout_session(booking, slot, student, tutor):",
    "Creates a Stripe Checkout Session. Calculates platform fee, creates a pending Payment record, configures Connect split payment if tutor has Stripe account. Returns the Stripe-hosted checkout URL.",
    [
      ["booking", "Booking", "Yes", "—", "The booking being paid for"],
      ["slot", "TutorSlot", "Yes", "—", "The slot (provides price, subject, date/time)"],
      ["student", "Student", "Yes", "—", "The paying student (provides email)"],
      ["tutor", "Tutor", "Yes", "—", "The tutor (provides name, Stripe account)"],
    ],
    "str: Stripe Checkout Session URL for redirect. Raises Exception on failure.",
    [
      "DB INSERT: Payment record with status='pending'",
      "DB UPDATE: Payment.stripe_checkout_session_id after Stripe call",
      "External API: stripe.checkout.Session.create()",
    ],
    [
      ["Stripe API error", "Exception raised (re-raised after rollback)", "Caller must catch and show error"],
      ["slot.price is None/0", "Creates $0 checkout (may fail at Stripe)", "Validate price > 0 before calling"],
      ["Tutor has no Stripe account", "No Connect split — platform receives all funds", "Tutor won't receive payout automatically"],
    ],
    "payment_checkout_proceed, payment_retry, book_session (via tutor_routes)",
    "stripe.checkout.Session.create, Payment(), db.session.add/flush/commit",
    "The application_fee_amount and transfer_data are only set if tutor.stripe_account_id AND stripe_onboarding_complete are true. Otherwise, all funds go to the platform account."
  ),

  ...funcBlock(
    "process_successful_payment",
    "def process_successful_payment(checkout_session_id):",
    "Called by the webhook handler after Stripe confirms payment. Retrieves the Stripe session to get the payment_intent ID, marks Payment as completed, updates Booking status to Confirmed.",
    [["checkout_session_id", "str", "Yes", "—", "Stripe Checkout Session ID from webhook event"]],
    "bool: True if payment found and processed, False if no matching Payment record.",
    [
      "DB UPDATE: Payment.status → 'completed', Payment.stripe_payment_intent_id set, Payment.completed_at set",
      "DB UPDATE: Booking.status → 'Confirmed'",
      "External API: stripe.checkout.Session.retrieve()",
    ],
    [
      ["No Payment found for session ID", "Returns False", "Orphaned Stripe session — investigate"],
      ["Stripe.retrieve fails", "Exception propagates to webhook handler", "Webhook handler should catch and log"],
    ],
    "stripe_webhook (payment_routes.py)",
    "Payment.query.filter_by, stripe.checkout.Session.retrieve, db.session.commit",
    "No idempotency check — if webhook fires twice, this sets completed twice. Harmless but worth noting."
  ),

  ...funcBlock(
    "process_refund",
    "def process_refund(payment_id, refund_percent):",
    "Processes a partial or full Stripe refund. Updates payment record with refund details.",
    [
      ["payment_id", "int", "Yes", "—", "Payment to refund"],
      ["refund_percent", "int/float", "Yes", "—", "Percentage to refund (0-100)"],
    ],
    "stripe.Refund object on success, None on failure or if payment not eligible.",
    [
      "External API: stripe.Refund.create()",
      "DB UPDATE: Payment.refund_amount, stripe_refund_id, status → 'refunded' or 'partial_refund'",
    ],
    [
      ["Payment not found", "Returns None", "Check payment ID"],
      ["Payment not completed/partial_refund", "Returns None", "Can only refund completed payments"],
      ["Refund amount ≤ 0", "Returns None", "0% refund requested"],
      ["Stripe refund error", "Rollback, returns None", "Log shows StripeError details"],
    ],
    "cancel_booking (booking_service.py), admin refund routes",
    "Payment.query.get, stripe.Refund.create, db.session.commit/rollback",
    "Refund amount is calculated as percentage of original amount. Does not account for previous partial refunds — could over-refund if called twice with different percentages."
  ),

  ...funcBlock(
    "create_connect_account_link",
    "def create_connect_account_link(tutor):",
    "Creates or retrieves a Stripe Connect Express account for the tutor, then generates an onboarding link.",
    [["tutor", "Tutor", "Yes", "—", "Tutor to onboard to Stripe Connect"]],
    "str: Stripe AccountLink URL for redirect.",
    [
      "External API: stripe.Account.create() (if no existing account)",
      "External API: stripe.AccountLink.create()",
      "DB UPDATE: Tutor.stripe_account_id (if newly created)",
    ],
    [
      ["Stripe API error", "Exception propagates to caller", "Caller must catch"],
    ],
    "stripe_onboard (payment_routes.py)",
    "stripe.Account.create, stripe.AccountLink.create, db.session.commit",
    "Account type is 'express' with card_payments + transfers capabilities."
  ),

  h2("Error Handling Summary"),
  makeTable(["Function", "Exception Caught", "Handler", "Logged?", "Risk"], [
    ["create_checkout_session", "General Exception", "Rollback, re-raise", "Yes", "Caller sees full exception"],
    ["process_successful_payment", "None (no try/except)", "Propagates to webhook handler", "No", "Webhook handler wraps this"],
    ["process_refund", "stripe.error.StripeError", "Rollback, return None", "Yes", "Silent failure — caller must check return"],
    ["create_connect_account_link", "None", "Propagates", "No", "Caller must handle"],
  ], [2400, 2000, 1800, 800, 2360]),
]));

// ═══════════════════════════════════════════════════════
// SECTION 4: services/booking_service.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("services/booking_service.py", [
  h1("4. booking_service.py (services/booking_service.py)"),
  h2("Overview"),
  para("Central booking logic: refund percentage calculation, slot reopening, booking cancellation with refund, booking creation with row-level locking, and booking confirmation emails. This service is the transactional backbone — it coordinates DB changes, payment refunds, email notifications, cache invalidation, and event publishing for every booking lifecycle event."),

  ...funcBlock(
    "calculate_refund_percentage",
    "def calculate_refund_percentage(slot):",
    "Calculates refund percentage based on hours until session start. Policy: >24h = 100%, 12-24h = 50%, <12h = 0%.",
    [["slot", "TutorSlot", "Yes", "—", "Slot to calculate refund for"]],
    "int: 0, 50, or 100.",
    [],
    [["slot.date or start_time is None", "Exception on datetime.combine", "Caller should validate slot has date/time"]],
    "cancel_booking, request_refund (payment_routes.py)",
    "datetime.combine, datetime.utcnow",
    "Uses UTC time — no timezone adjustment. A session at 9 AM EST cancelled at 8 AM EST (1 hour before) would show ~6 hours in UTC if server is UTC."
  ),

  ...funcBlock(
    "reopen_slot",
    "def reopen_slot(slot):",
    "Reopens a slot after cancellation. For group slots, decrements current_students and reopens if below capacity. For solo slots, resets status to 'pending' and clears student_id.",
    [["slot", "TutorSlot", "Yes", "—", "Slot to reopen (can be None)"]],
    "bool: True if slot was reopened, False if slot is None.",
    ["DB WRITE: TutorSlot.status, student_id, current_students (uncommitted — caller must commit)"],
    [["slot is None", "Returns False", "No action needed"]],
    "cancel_booking, payment_cancel (payment_routes.py)",
    "max()",
    "Does NOT call db.session.commit() — caller is responsible for committing."
  ),

  ...funcBlock(
    "cancel_booking",
    "def cancel_booking(booking, cancelled_by, refund_pct=None, slot=None):",
    "Full booking cancellation: marks booking as cancelled, reopens slot, processes refund if applicable, publishes booking.cancelled event.",
    [
      ["booking", "Booking", "Yes", "—", "The booking to cancel"],
      ["cancelled_by", "str", "Yes", "—", "'student' or 'tutor'"],
      ["refund_pct", "int/None", "No", "None", "Override refund %. If None, auto-calculated (100% for tutor cancel, policy-based for student)"],
      ["slot", "TutorSlot/None", "No", "None", "Pre-fetched slot. If None, fetched from DB"],
    ],
    "dict: {refund_pct: int, refund_processed: bool, slot_reopened: bool}",
    [
      "DB UPDATE: Booking.status='Cancelled', cancelled_by, cancelled_on",
      "DB UPDATE: Slot reopened via reopen_slot()",
      "Refund: process_refund() called if refund_pct > 0 and completed payment exists",
      "Event: booking.cancelled published to Redis",
    ],
    [
      ["No completed payment found", "Refund skipped", "refund_processed=False in return"],
      ["Refund processing error", "Caught, logged", "refund_processed=False"],
      ["Event publish error", "Caught as warning", "Notification service misses event"],
    ],
    "tutor_routes.cancel_booking, admin routes, reschedule routes",
    "reopen_slot, calculate_refund_percentage, process_refund, publish_event, db.session.commit",
    "Commits the booking/slot changes BEFORE attempting refund. If refund fails, booking is still cancelled but refund_processed=False."
  ),

  ...funcBlock(
    "create_booking",
    "def create_booking(student_id, tutor_id, slot_id, student_name=None, student_email=None, is_minor=False, guardian=None):",
    "Creates a booking with row-level locking (SELECT FOR UPDATE) to prevent double-booking. Handles group and solo slots, generates Jitsi room, invalidates caches, publishes booking.created event.",
    [
      ["student_id", "int", "Yes", "—", "Student making the booking"],
      ["tutor_id", "int", "Yes", "—", "Tutor being booked"],
      ["slot_id", "int", "Yes", "—", "Slot being booked"],
      ["student_name", "str", "No", "None", "For event payload"],
      ["student_email", "str", "No", "None", "Unused in this function"],
      ["is_minor", "bool", "No", "False", "Unused in this function"],
      ["guardian", "Guardian", "No", "None", "Unused in this function"],
    ],
    "tuple: (Booking, None) on success, (None, error_message) on failure.",
    [
      "DB: SELECT FOR UPDATE on TutorSlot (row lock)",
      "DB UPDATE: TutorSlot.status, student_id, current_students",
      "DB INSERT: Booking record",
      "Cache: Deletes search:* and rec:* patterns",
      "Video: generate_room_name() for online/both slots",
      "Event: booking.created published",
    ],
    [
      ["Slot not found", "Rollback, return (None, 'Slot not found.')", "Invalid slot_id"],
      ["Solo slot already booked", "Rollback, return (None, 'already been booked')", "Race condition lost"],
      ["Group slot full", "Rollback, return (None, 'now full')", "Race condition lost"],
      ["General Exception", "Rollback, return (None, 'An error occurred...')", "Log for investigation"],
    ],
    "book_session (tutor_routes.py)",
    "TutorSlot.query.with_for_update, cache_delete_pattern, generate_room_name, Booking(), publish_event",
    "is_minor, guardian, student_email parameters are accepted but unused — they were likely intended for future guardian approval flow.",
    ["booking, err = create_booking(", "    student_id=5, tutor_id=12, slot_id=42,", "    student_name='Alice')", "if err:", "    flash(err, 'warning')"]
  ),

  ...funcBlock(
    "send_booking_emails",
    "def send_booking_emails(booking, slot, student_name, student_email, is_minor=False, guardian=None):",
    "Sends booking confirmation emails to student, tutor, and guardian (if minor). Sets booking flags for email tracking.",
    [
      ["booking", "Booking", "Yes", "—", "The booking"],
      ["slot", "TutorSlot", "Yes", "—", "The booked slot"],
      ["student_name", "str", "Yes", "—", "Student's display name"],
      ["student_email", "str", "Yes", "—", "Student's email"],
      ["is_minor", "bool", "No", "False", "Whether student is under 18"],
      ["guardian", "Guardian", "No", "None", "Guardian for notification"],
    ],
    "None (side-effect only).",
    [
      "Email: booking confirmation to student",
      "Email: booking notification to tutor",
      "Email: guardian booking alert (if is_minor and guardian)",
      "DB UPDATE: booking.guardian_notified, booking.confirmation_email_sent",
    ],
    [["Any email failure", "Caught, logged", "Emails are best-effort — booking still valid"]],
    "book_session (tutor_routes.py), stripe_webhook (payment_routes.py)",
    "send_email, email_booking_confirmation, email_booking_tutor_notify, email_guardian_booking_alert, Tutor.query.get",
    null
  ),
]));

// ═══════════════════════════════════════════════════════
// SECTION 5: services/email_service.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("services/email_service.py", [
  h1("5. email_service.py (services/email_service.py)"),
  h2("Overview"),
  para("Email dispatch hub for the entire platform. Provides send_email() which first checks user notification preferences, then attempts async delivery via Celery, falling back to synchronous Resend API calls. Also contains all HTML email template functions (welcome, booking confirmation, reminders, guardian alerts, password reset, tutor verification status emails)."),

  h2("Constants"),
  makeTable(["Name", "Type", "Description"], [
    ["EMAIL_TYPE_PREF_MAP", "dict", "Maps email_type to notification preference key. Types not in this map always send (e.g., welcome, guardian, password_reset)."],
    ["STYLE", "str", "Inline CSS for email body wrapper — Inter/Arial, 600px max-width, 32px padding"],
    ["BTN", "str", "Inline CSS for CTA buttons — 14px 28px padding, 8px radius, bold"],
  ], [2600, 1000, 5760]),

  ...funcBlock(
    "send_email",
    "def send_email(to_email, subject, html_body, email_type, recipient_type='student', booking_id=None):",
    "Primary email dispatch. Checks notification preferences, attempts Celery async send, falls back to synchronous send.",
    [
      ["to_email", "str", "Yes", "—", "Recipient email address"],
      ["subject", "str", "Yes", "—", "Email subject line"],
      ["html_body", "str", "Yes", "—", "Full HTML content"],
      ["email_type", "str", "Yes", "—", "Type tag (booking_confirm, session_reminder, etc.)"],
      ["recipient_type", "str", "No", "'student'", "student, tutor, guardian, admin"],
      ["booking_id", "int/None", "No", "None", "FK to bookings table for log tracking"],
    ],
    "bool: True if queued/sent, False if skipped by preference or failed.",
    [
      "Celery: send_email_task.delay() queued (preferred path)",
      "Fallback: _send_email_sync() called if Celery unavailable",
      "DB INSERT: EmailNotification log (via sync path or Celery task)",
      "External API: Resend.com email API",
    ],
    [
      ["User opted out of email type", "Returns False, logged as 'skipped'", "Respect preference"],
      ["Celery unavailable", "Falls back to sync send", "Emails still sent, just blocking"],
      ["Resend API key missing", "Email skipped, logged", "Configure RESEND_API_KEY"],
      ["Resend API error", "Email status set to 'failed' in DB", "Check email_notifications table"],
    ],
    "All routes and services that send email",
    "_check_notification_prefs, send_email_task.delay, _send_email_sync",
    "The Celery fallback to sync is a reliability feature — emails are never silently dropped if Celery is down."
  ),

  para("The following email template functions are straightforward and documented in summary form:"),
  makeTable(
    ["Function", "Returns (subject, html)", "Used For"],
    [
      ["email_welcome_student(name, verify_url)", "Welcome + verify email link", "Student registration"],
      ["email_welcome_tutor(name)", "Welcome + next steps list", "Tutor registration"],
      ["email_guardian_verification(guardian_name, student_name, verify_url)", "Guardian approval request", "Minor student registration"],
      ["email_booking_confirmation(student_name, tutor_name, date, time, mode)", "Session booked confirmation", "Post-booking/payment"],
      ["email_booking_tutor_notify(tutor_name, student_name, date, time, mode)", "New booking alert", "Post-booking/payment"],
      ["email_session_reminder(name, other_name, date, time, hours_before)", "Session reminder (24h/1h)", "Scheduler service"],
      ["email_guardian_booking_alert(guardian_name, student_name, tutor_name, date, time)", "Child booked a session", "Minor student booking"],
      ["email_documents_received(tutor_name)", "Documents under review", "Doc upload"],
      ["email_tutor_approved(tutor_name)", "Profile verified", "Admin approval"],
      ["email_password_reset(name, reset_url)", "Password reset link (1hr expiry)", "Forgot password flow"],
      ["email_tutor_rejected(tutor_name, reason)", "Verification rejected + reason", "Admin rejection"],
    ],
    [4000, 2600, 2760]
  ),
]));

// ═══════════════════════════════════════════════════════
// SECTION 6: services/recommendation_service.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("services/recommendation_service.py", [
  h1("6. recommendation_service.py (services/recommendation_service.py)"),
  h2("Overview"),
  para("Implements a weighted multi-factor scoring algorithm to recommend tutors. Factors: subject match (40%), rating (25%), distance (20%), experience (10%), availability (5%). Results are cached in Redis for 1 hour."),

  ...funcBlock(
    "calculate_tutor_score",
    "def calculate_tutor_score(tutor, student_lat=None, student_lng=None, target_subject=None, slot_count=0):",
    "Computes a recommendation score (0-100) for a single tutor based on weighted factors.",
    [
      ["tutor", "Tutor", "Yes", "—", "Tutor to score"],
      ["student_lat", "float", "No", "None", "Student latitude for distance calc"],
      ["student_lng", "float", "No", "None", "Student longitude"],
      ["target_subject", "str", "No", "None", "Subject being searched"],
      ["slot_count", "int", "No", "0", "Number of available slots in next 7 days"],
    ],
    "float: Score 0.0–100.0 rounded to 1 decimal.",
    [],
    [["Missing lat/lng", "Distance score defaults to 0.5 (neutral)", "Acceptable fallback"]],
    "get_recommended_tutors",
    "haversine_distance, config weight values",
    "Subject match: exact primary = 1.0, additional subject = 0.7, no match = 0.0, no target = 0.5. Distance capped at 50km. Experience capped at 20 years."
  ),

  ...funcBlock(
    "get_recommended_tutors",
    "def get_recommended_tutors(student_lat=None, student_lng=None, subject=None, limit=20):",
    "Returns top N recommended tutors. Checks Redis cache first. If miss, loads all verified tutors, batch-fetches slot counts, scores each, sorts, caches result IDs for 1 hour.",
    [
      ["student_lat", "float", "No", "None", "Student latitude"],
      ["student_lng", "float", "No", "None", "Student longitude"],
      ["subject", "str", "No", "None", "Target subject"],
      ["limit", "int", "No", "20", "Max results"],
    ],
    "list of Tutor objects, ordered by score descending.",
    [
      "Redis READ: cache_get('rec:{subject}:{lat}:{lng}')",
      "DB READ: All verified Tutors (cache miss path)",
      "DB READ: Batch slot counts via _batch_slot_counts()",
      "Redis WRITE: cache_set() with 1-hour TTL",
    ],
    [["Redis unavailable", "Cache miss — always computes fresh", "Slower but functional"]],
    "Homepage, search page, tutor profile (similar tutors)",
    "cache_get, cache_set, Tutor.query, _batch_slot_counts, calculate_tutor_score",
    "PERFORMANCE: Loads ALL verified tutors on cache miss. For large platforms, consider pagination or DB-side scoring.",
    ["tutors = get_recommended_tutors(", "    student_lat=40.7128, student_lng=-74.0060,", "    subject='Mathematics', limit=10)", "# Returns: [<Tutor 'Dr. Smith'>, <Tutor 'Prof. Lee'>, ...]"]
  ),
]));

// ═══════════════════════════════════════════════════════
// SECTION 7: services/scheduler_service.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("services/scheduler_service.py", [
  h1("7. scheduler_service.py (services/scheduler_service.py)"),
  h2("Overview"),
  para("APScheduler-based background job system. Runs 5 recurring jobs: session reminders (every 15 min), document cleanup (daily 3 AM), reschedule expiry (hourly), overdue assignments (daily 8 AM), recording cleanup (daily 4 AM). All jobs run within Flask app context."),

  h2("Scheduled Jobs Inventory"),
  makeTable(["Job ID", "Schedule", "Function", "What It Does", "DB Modified"], [
    ["session_reminders", "Every 15 min", "check_reminders", "Sends 24h and 1h session reminders to students, tutors, guardians", "TutorSlot.reminder_24h_sent, reminder_1h_sent"],
    ["document_cleanup", "Daily 3:00 AM", "cleanup_expired_documents", "Deletes R2 files for verified tutors past DOC_RETENTION_DAYS (90)", "TutorDocument.file_deleted, file_deleted_on"],
    ["reschedule_expiry", "Every 1 hour", "check_expired_reschedules", "Marks pending reschedule requests as expired past 48h deadline", "RescheduleRequest.status → 'expired'"],
    ["overdue_assignments", "Daily 8:00 AM", "check_overdue_assignments", "Marks assigned assignments past due_date as overdue", "Assignment.status → 'overdue'"],
    ["recording_cleanup", "Daily 4:00 AM", "cleanup_expired_recordings", "Deletes R2 recording files past their expires_at date", "SessionRecording.is_deleted → True"],
  ], [1600, 1400, 2000, 2400, 1960]),

  ...funcBlock(
    "check_reminders",
    "def check_reminders(app):",
    "Main reminder job. Queries booked slots in next ~26 hours that haven't had reminders sent. Batch-loads tutors and students, then sends 24h and 1h reminders.",
    [["app", "Flask app", "Yes", "—", "Flask application for app_context"]],
    "None (side-effect only).",
    [
      "DB READ: TutorSlot (booked, next 26h, unsent reminders), batch Tutor, batch Student",
      "Email: Session reminders to student, tutor, and guardian (if minor)",
      "DB UPDATE: reminder_24h_sent, reminder_1h_sent flags",
    ],
    [["No upcoming slots", "Returns early", "No action needed"], ["Email send fails", "Exception from send_email — logged by email service", "Slot flags still updated"]],
    "APScheduler (every 15 min)",
    "_send_slot_reminders_batch, send_email, email_session_reminder",
    "Safety limit of 500 slots per run. Uses batch loading for tutors and students to avoid N+1 queries. Window: 24h reminder at 23-25h before, 1h reminder at 0.5-1.5h before."
  ),

  ...funcBlock(
    "cleanup_expired_documents",
    "def cleanup_expired_documents(app):",
    "Deletes files from R2 for tutor documents where the tutor was verified more than DOC_RETENTION_DAYS ago.",
    [["app", "Flask app", "Yes", "—", "Flask app for context and config"]],
    "None.",
    [
      "DB READ: TutorDocument joined with Tutor where verified_on ≤ cutoff",
      "External: delete_document() for each expired doc (R2 or local)",
      "DB UPDATE: file_deleted=True, file_deleted_on=now for each deleted doc",
    ],
    [["R2 delete fails for individual doc", "Skipped (success check)", "File remains — will retry next run"]],
    "APScheduler (daily 3 AM)",
    "delete_document, TutorDocument.query.join(Tutor)",
    "Only deletes files for VERIFIED tutors. Rejected/pending tutors keep their documents until verified."
  ),

  h2("Inter-File Dependency Map"),
  para("scheduler_service.py imports from: models (TutorSlot, Tutor, Student, TutorDocument, RescheduleRequest, Assignment, SessionRecording), services (email_service, storage_service), database. It is imported by app.py during startup (init_scheduler). If broken: no session reminders, expired documents accumulate in R2, overdue assignments not flagged, reschedule requests never expire."),
]));

// ═══════════════════════════════════════════════════════
// SECTION 8: shared/event_bus.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("shared/event_bus.py", [
  h1("8. event_bus.py (shared/event_bus.py)"),
  h2("Overview"),
  para("Redis pub/sub event bus for inter-service communication. Publishes events to 'tw:events' channel, listens on a background thread with auto-reconnect. Events have a JSON envelope with type, data, timestamp, and source. Self-messages are filtered (a service ignores its own events)."),

  h2("Module-Level State"),
  makeTable(["Variable", "Type", "Purpose"], [
    ["_redis_url", "str/None", "Redis connection URL, set by init_event_bus()"],
    ["_service_name", "str", "Name of current service — used to filter self-messages"],
    ["_subscriptions", "dict", "channel → [handler_functions] mapping"],
    ["_listener_thread", "Thread/None", "Background daemon thread for event listening"],
  ], [2200, 1600, 5560]),

  ...funcBlock(
    "publish_event",
    "def publish_event(event_type, data, channel=None):",
    "Publishes an event to Redis pub/sub. Creates a JSON envelope with event type, data payload, timestamp, and source service name.",
    [
      ["event_type", "str", "Yes", "—", "Event name (e.g., 'booking.created', 'payment.completed')"],
      ["data", "dict", "Yes", "—", "Event payload"],
      ["channel", "str", "No", "'tw:events'", "Redis channel to publish to"],
    ],
    "bool: True if published, False if Redis unavailable or publish failed.",
    ["Redis PUBLISH: JSON envelope to channel"],
    [
      ["Redis URL not configured", "Returns False, logs warning", "Event silently dropped"],
      ["Redis connection fails", "Returns False, logs warning", "Event silently dropped"],
      ["Publish exception", "Returns False, logs error", "Event silently dropped"],
    ],
    "booking_service (booking.created, booking.cancelled), payment_routes (payment.completed)",
    "_get_publisher_redis, redis.publish, json.dumps",
    "Events are fire-and-forget. No persistence, no retry, no delivery guarantee. If Redis is down, events are lost."
  ),

  ...funcBlock(
    "start_event_listener",
    "def start_event_listener(app, channel='tw:events'):",
    "Starts a background daemon thread that subscribes to Redis pub/sub and dispatches events to registered handlers.",
    [
      ["app", "Flask app", "Yes", "—", "Flask app for app_context in handlers"],
      ["channel", "str", "No", "'tw:events'", "Redis channel to subscribe to"],
    ],
    "None.",
    ["Thread: starts daemon thread running _listener_loop"],
    [
      ["No Redis URL", "Returns without starting", "No listener"],
      ["No subscriptions", "Returns without starting", "No handlers registered"],
      ["Already running", "Returns", "Prevents duplicate listeners"],
    ],
    "Microservice app.py on startup",
    "threading.Thread, _listener_loop",
    "The listener auto-reconnects on connection loss with 5-second backoff. Self-messages (same service_name) are filtered. Invalid JSON messages are logged and skipped."
  ),

  h2("Event Envelope Format"),
  codeBlock([
    '{',
    '  "event": "booking.created",',
    '  "data": {"booking_id": 42, "student_id": 5, ...},',
    '  "timestamp": "2026-03-12T14:30:00",',
    '  "source": "core-service"',
    '}',
  ]),
]));

// ═══════════════════════════════════════════════════════
// SECTION 9: shared/jwt_auth.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("shared/jwt_auth.py", [
  h1("9. jwt_auth.py (shared/jwt_auth.py)"),
  h2("Overview"),
  para("JWT authentication for the microservice architecture. The core service issues JWTs on login; other services validate them using the shared secret key. Provides decorators (@jwt_required, @jwt_optional, @internal_only) and token utility functions."),

  h2("Token Extraction Priority"),
  para("get_jwt_from_request() checks three locations in order: 1) Authorization: Bearer header, 2) ?token= query parameter, 3) tw_jwt cookie."),

  para("Functions documented in summary form:"),
  makeTable(["Function", "Parameters", "Returns", "Notes"], [
    ["create_jwt_token", "uid, role, name, email=None, extra=None", "str: JWT token (24h expiry)", "Uses JWT_SECRET_KEY or SECRET_KEY. HS256 algorithm."],
    ["decode_jwt_token", "token", "dict: payload", "Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError"],
    ["get_jwt_from_request", "(none)", "str/None: token from header/query/cookie", "Priority: Bearer > query param > cookie"],
    ["create_internal_token", "(none)", "str: JWT with role='internal', 60s expiry", "For service-to-service calls"],
  ], [2200, 2800, 2200, 2160]),

  h2("Decorators"),
  makeTable(["Decorator", "Behavior on No Token", "Behavior on Invalid Token", "Passes to Function"], [
    ["@jwt_required", "401 JSON error", "403 JSON error (401 if expired)", "jwt_payload as first arg"],
    ["@jwt_optional", "Passes None", "Passes None (treats as anonymous)", "jwt_payload (or None) as first arg"],
    ["@internal_only", "401 JSON error", "403 JSON error", "jwt_payload as first arg; also checks role='internal'"],
  ], [2000, 2200, 2800, 2360]),

  infoBox("SECURITY: JWT_SECRET_KEY defaults to SECRET_KEY if not set. In production, these should be different — leaking SECRET_KEY would compromise both session cookies AND JWT tokens.", "danger"),
]));

// ═══════════════════════════════════════════════════════
// SECTION 10: shared/service_client.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("shared/service_client.py", [
  h1("10. service_client.py (shared/service_client.py)"),
  h2("Overview"),
  para("HTTP client for inter-service REST calls with circuit breaker pattern, retry logic, and automatic JWT authentication. Used by microservices to call the core service for user/tutor/slot data."),

  h2("CircuitBreaker Class"),
  para("States: CLOSED (normal) → OPEN (after 5 failures, blocks calls) → HALF_OPEN (after 30s recovery timeout, allows one test call). Success resets to CLOSED."),
  makeTable(["Parameter", "Default", "Description"], [
    ["failure_threshold", "5", "Failures before opening circuit"],
    ["recovery_timeout", "30", "Seconds before trying again"],
  ], [2400, 1400, 5560]),

  h2("ServiceClient Class"),
  makeTable(["Config", "Default", "Description"], [
    ["SERVICE_CLIENT_TIMEOUT", "3s", "HTTP request timeout"],
    ["SERVICE_CLIENT_RETRIES", "2", "Max retry attempts (total = retries + 1)"],
    ["CORE_SERVICE_URL", "http://core-service:5000", "Core service base URL"],
    ["SEARCH_SERVICE_URL", "http://search-service:5000", "Search service URL"],
    ["CHAT_SERVICE_URL", "http://chat-service:5000", "Chat service URL"],
    ["LEARNING_SERVICE_URL", "http://learning-service:5000", "Learning service URL"],
    ["NOTIFICATION_SERVICE_URL", "http://notification-service:5000", "Notification service URL"],
  ], [2600, 2600, 4160]),

  ...funcBlock(
    "_request",
    "def _request(self, method, service_name, path, params=None, json_data=None, timeout=None):",
    "Core HTTP request method with circuit breaker check, JWT auth header injection, retry with exponential backoff, and error handling.",
    [
      ["method", "str", "Yes", "—", "HTTP method (GET, POST)"],
      ["service_name", "str", "Yes", "—", "Service name key (core, search, etc.)"],
      ["path", "str", "Yes", "—", "URL path to append"],
      ["params", "dict", "No", "None", "Query parameters"],
      ["json_data", "dict", "No", "None", "JSON body"],
      ["timeout", "int", "No", "None", "Override timeout"],
    ],
    "dict/None: Parsed JSON response, or None if all retries fail or circuit is open.",
    ["HTTP request with JWT auth header", "Circuit breaker state updates"],
    [
      ["Circuit open", "Returns None immediately", "Wait for recovery_timeout"],
      ["500+ status code", "Treated as failure, triggers retry", "Server error"],
      ["Connection error / timeout", "Retried with exponential backoff (0.5s, 1s, 2s)", "Service unavailable"],
      ["All retries exhausted", "Records failure in circuit breaker, returns None", "Circuit may open"],
    ],
    "get, post convenience methods; get_user, get_tutor, get_slot, get_tutors_batch",
    "requests.Session.request, _get_breaker, _get_internal_token",
    "Backoff formula: 0.5 * (2^attempt) seconds. 204 responses return empty dict. 4xx responses are NOT retried."
  ),
]));

module.exports = sections;
