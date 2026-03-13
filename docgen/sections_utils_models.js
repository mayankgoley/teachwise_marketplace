const { buildSection, h1, h2, h3, h4, para, txt, bullet, codeBlock, makeTable, infoBox, funcBlock, spacer, C } = require("./generate_code_reference");

const sections = [];

// ═══════════════════════════════════════════════════════
// SECTION 11: utils/auth.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("utils/auth.py", [
  h1("11. auth.py (utils/auth.py)"),
  h2("Overview"),
  para("Authentication utility functions: role-based route protection decorator and account lockout system (lock after 5 failed attempts for 15 minutes)."),

  h2("Constants"),
  makeTable(["Name", "Value", "Description"], [
    ["MAX_FAILED_ATTEMPTS", "5", "Failed logins before account lockout"],
    ["LOCKOUT_DURATION_MINUTES", "15", "Lockout duration in minutes"],
  ], [3000, 1400, 4960]),

  ...funcBlock(
    "role_required",
    "def role_required(*roles):",
    "Decorator factory that restricts route access to specific user roles. Wraps @login_required automatically.",
    [["*roles", "str", "Yes", "—", "Allowed role names (e.g., 'tutor', 'student', 'admin')"]],
    "Decorator function. If role mismatch: flash 'Access denied.', redirect to index.",
    [],
    [["User not logged in", "login_required triggers redirect to login page", "Standard Flask-Login behavior"],
     ["Wrong role", "Flash danger, redirect to main.index", "User sees access denied"]],
    "Nearly every route in tutor_routes, student_routes, admin_routes, guardian_routes",
    "current_user.user_type, login_required",
    null
  ),

  ...funcBlock(
    "is_account_locked",
    "def is_account_locked(user):",
    "Checks if account is locked. If lock has expired, auto-resets failed_login_attempts and locked_until.",
    [["user", "User model", "Yes", "—", "Any user model with failed_login_attempts and locked_until"]],
    "bool: True if locked and not yet expired.",
    ["DB UPDATE + COMMIT: Resets lockout fields if expired"],
    [["User model lacks locked_until", "Returns False (hasattr check)", "Safe for models without lockout"]],
    "tutor_routes.login, student_routes.login, admin_routes.login, guardian_routes.login",
    "db.session.commit",
    "Commits immediately on lock expiry. This is a side-effect of a check function — unexpected but necessary for UX."
  ),

  para("Related functions documented in summary:"),
  makeTable(["Function", "Purpose", "Side Effects"], [
    ["increment_failed_login(user)", "Increments failed count, locks at threshold", "DB COMMIT: updates failed_login_attempts, sets locked_until if ≥ 5"],
    ["reset_failed_login(user)", "Resets counter and lockout on successful login", "DB COMMIT: sets failed_login_attempts=0, locked_until=None"],
  ], [2800, 3800, 2760]),
]));

// ═══════════════════════════════════════════════════════
// SECTION 12: utils/validators.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("utils/validators.py", [
  h1("12. validators.py (utils/validators.py)"),
  h2("Overview"),
  para("Input validation functions for registration and profile forms. Validates passwords, emails, names, phone numbers, URLs, and dates of birth."),

  para("All functions documented in summary form:"),
  makeTable(["Function", "Parameters", "Returns", "Validation Rules"], [
    ["validate_password_complexity(password)", "password: str", "bool", "≥12 chars, ≥1 uppercase, ≥1 digit, ≥1 special char"],
    ["get_password_error_message(password)", "password: str", "str/None", "Returns specific error message for first failing rule, or None if valid"],
    ["validate_email_format(email)", "email: str", "str/None", "Lowercased + trimmed email, or None if invalid. Regex check + ≤120 chars"],
    ["validate_name(name, max_length=100)", "name: str, max_length: int", "(str, None) or ('', error)", "Strips whitespace, rejects HTML tags, enforces max_length"],
    ["validate_phone(phone)", "phone: str", "(str, None) or ('', error)", "Allows digits, +, -, (), spaces. Requires ≥7 digits"],
    ["validate_url(url)", "url: str", "(str, None) or ('', error)", "Must start with http(s)://, ≤2048 chars"],
    ["validate_date_of_birth(dob_str, min_age=0, max_age=120)", "dob_str: str, min/max_age: int", "(date, None) or (None, error)", "YYYY-MM-DD format, not future, age within range"],
  ], [3400, 2200, 1800, 1960]),

  infoBox("validate_name() checks for HTML tags using regex r'<[^>]+>'. This is NOT a substitute for sanitize_text() — it's an input rejection check, not a sanitization filter.", "warning"),
]));

// ═══════════════════════════════════════════════════════
// SECTION 13: utils/sanitizer.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("utils/sanitizer.py", [
  h1("13. sanitizer.py (utils/sanitizer.py)"),
  h2("Overview"),
  para("HTML sanitization using the bleach library. Three levels: strip all HTML, allow safe formatting tags, and length-limited sanitization."),

  makeTable(["Function", "Allowed Tags", "Use For", "Returns"], [
    ["sanitize_text(text)", "None (strips all)", "Bio, comments, names, feedback", "str or None"],
    ["sanitize_rich_text(text)", "p, br, b, i, strong, em, ul, ol, li", "Fields needing basic formatting", "str or None"],
    ["sanitize_input_length(text, max_length)", "None (strips all)", "Any field with max length constraint", "str or None (truncated to max_length)"],
  ], [3200, 2200, 2200, 1760]),

  para("All functions return None if input is None or becomes empty after sanitization."),
]));

// ═══════════════════════════════════════════════════════
// SECTION 14: celery_app.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("celery_app.py", [
  h1("14. celery_app.py (celery_app.py)"),
  h2("Overview"),
  para("Celery application configuration. Defines the broker/backend (Redis), serialization format, task routing, timeouts, and rate limits. Auto-discovers tasks in services.tasks."),

  h2("Configuration"),
  makeTable(["Setting", "Value", "Description"], [
    ["broker / backend", "CELERY_BROKER_URL (Redis)", "Message queue and result storage"],
    ["task_serializer", "json", "All tasks use JSON serialization"],
    ["task_acks_late", "True", "Tasks acknowledged after completion (prevents loss on worker crash)"],
    ["worker_prefetch_multiplier", "1", "Workers fetch one task at a time"],
    ["task_soft_time_limit", "120s", "Soft timeout — raises SoftTimeLimitExceeded"],
    ["task_time_limit", "180s", "Hard timeout — worker killed"],
    ["result_expires", "3600s", "Results expire after 1 hour"],
    ["task_default_rate_limit", "100/m", "Default rate limit per task"],
    ["task_default_retry_delay", "30s", "Default delay before retry"],
    ["task_max_retries", "3", "Default max retry attempts"],
  ], [2800, 2400, 4160]),

  h2("Task Routing"),
  para("Email tasks (services.tasks.email_tasks.*) are routed to the 'email' queue, allowing dedicated email workers."),
]));

// ═══════════════════════════════════════════════════════
// SECTION 15: services/tasks/email_tasks.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("services/tasks/email_tasks.py", [
  h1("15. email_tasks.py (services/tasks/email_tasks.py)"),
  h2("Overview"),
  para("Celery task for asynchronous email delivery via Resend.com. Runs in worker process with Flask app context for DB access."),

  ...funcBlock(
    "send_email_task",
    "@celery.task(bind=True, name='services.tasks.email_tasks.send_email_task',\n  max_retries=3, default_retry_delay=30, rate_limit='100/m', acks_late=True)\ndef send_email_task(self, to_email, subject, html_body, email_type, ...):",
    "Sends an email via Resend API and logs the result to EmailNotification table. Retries up to 3 times with exponential backoff (30s, 60s, 120s).",
    [
      ["to_email", "str", "Yes", "—", "Recipient email"],
      ["subject", "str", "Yes", "—", "Email subject"],
      ["html_body", "str", "Yes", "—", "HTML content"],
      ["email_type", "str", "Yes", "—", "Type tag for logging"],
      ["recipient_type", "str", "No", "'student'", "Recipient category"],
      ["booking_id", "int", "No", "None", "Related booking FK"],
      ["api_key", "str", "No", "None", "Resend API key"],
      ["from_name", "str", "No", "None", "Sender display name"],
      ["from_addr", "str", "No", "None", "Sender email address"],
    ],
    "dict: {status: 'sent'/'skipped', ...} on success. Raises self.retry() on failure.",
    [
      "DB INSERT: EmailNotification log record",
      "External API: resend.Emails.send()",
      "DB UPDATE: EmailNotification.status, sent_at (on success) or error_message (on failure)",
    ],
    [
      ["No API key", "Status 'skipped', returns immediately", "Configure RESEND_API_KEY"],
      ["Resend API error", "Status 'failed', retry with backoff", "Auto-retries up to 3 times"],
      ["All retries exhausted", "Task fails permanently", "Check email_notifications table for error_message"],
    ],
    "send_email() in email_service.py (via .delay())",
    "resend.Emails.send, EmailNotification(), db.session.add/commit, self.retry",
    "Retry backoff: 30 * (2^retries) = 30s, 60s, 120s. Rate limited to 100 emails/minute to respect Resend API limits."
  ),
]));

// ═══════════════════════════════════════════════════════
// SECTION 16: services/storage_service.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("services/storage_service.py", [
  h1("16. storage_service.py (services/storage_service.py)"),
  h2("Overview"),
  para("File storage abstraction supporting Cloudflare R2 (S3-compatible) and local filesystem fallback. Handles both public files (profile photos) and encrypted private files (documents, recordings). Document uploads are encrypted with per-file Fernet keys, which are themselves encrypted with the master FERNET_KEY."),

  h2("Storage Decision"),
  para("_use_local_storage() returns True if R2_ENDPOINT_URL is empty, contains '<' (placeholder), or R2_ACCESS_KEY_ID starts with 'your-'. This enables transparent local development without R2 credentials."),

  ...funcBlock(
    "upload_document",
    "def upload_document(file_bytes, tutor_id, original_filename):",
    "Encrypts and uploads a document. Generates per-file Fernet key, encrypts file bytes, encrypts the file key with master key, computes SHA-256 hash of original, stores to R2 or local.",
    [
      ["file_bytes", "bytes", "Yes", "—", "Raw file content"],
      ["tutor_id", "int", "Yes", "—", "Tutor who owns the document"],
      ["original_filename", "str", "Yes", "—", "Original file name (for extension extraction)"],
    ],
    "dict: {r2_object_key, file_encryption_key, verification_hash, file_size_bytes} or None on failure.",
    [
      "File: Encrypted file written to R2 or local filesystem",
      "Crypto: Fernet key generated, file encrypted, key encrypted with master key",
    ],
    [
      ["R2 upload fails", "Returns None, logs error", "Retry upload"],
      ["Encryption fails", "Exception propagates", "Check FERNET_KEY config"],
    ],
    "tutor document upload routes",
    "Fernet.generate_key, Fernet.encrypt, encrypt_field, _get_r2_client, hashlib.sha256",
    "Object key format: documents/{tutor_id}/{uuid}.{ext}.enc. Two layers of encryption: file encrypted with per-file key, per-file key encrypted with master FERNET_KEY."
  ),

  ...funcBlock(
    "download_document",
    "def download_document(r2_object_key, encrypted_file_key):",
    "Downloads and decrypts a document. Decrypts file key with master key, fetches encrypted bytes from R2/local, decrypts file.",
    [
      ["r2_object_key", "str", "Yes", "—", "R2 key or local path"],
      ["encrypted_file_key", "str", "Yes", "—", "Fernet-encrypted file key"],
    ],
    "tuple: (decrypted_bytes, file_extension) or (None, None) on failure.",
    ["External: R2 GetObject or local file read", "Crypto: master key decrypt → file key → file decrypt"],
    [
      ["Decryption of file key fails", "Returns (None, None)", "Master FERNET_KEY may have changed"],
      ["R2 download fails", "Returns (None, None)", "File may have been deleted"],
      ["File decryption fails", "Returns (None, None)", "File corruption or key mismatch"],
    ],
    "Document download routes, admin document review",
    "decrypt_field, Fernet.decrypt, _get_r2_client",
    "Extension is extracted from the object key by splitting on dots and taking the second-to-last segment."
  ),

  para("Simple functions:"),
  makeTable(["Function", "Purpose", "Storage"], [
    ["upload_public_file(file_data, path, content_type)", "Upload unencrypted public file (photos)", "R2 or static/uploads/"],
    ["delete_public_file(path)", "Delete a public file", "R2 or local"],
    ["delete_document(r2_object_key)", "Delete an encrypted file", "R2 or local"],
  ], [4000, 3200, 2160]),
]));

// ═══════════════════════════════════════════════════════
// SECTION 17: services/encryption_service.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("services/encryption_service.py", [
  h1("17. encryption_service.py (services/encryption_service.py)"),
  h2("Overview"),
  para("Provides Fernet symmetric encryption for sensitive fields and URL-safe signed tokens for email verification and password resets. Two distinct crypto systems: Fernet (FERNET_KEY) for field encryption, and itsdangerous URLSafeTimedSerializer (SECRET_KEY) for tokens."),

  makeTable(["Function", "Key Used", "Purpose", "Returns"], [
    ["get_fernet()", "FERNET_KEY", "Creates Fernet cipher instance", "Fernet object. Raises ValueError if key not set."],
    ["encrypt_field(plaintext)", "FERNET_KEY", "Encrypts a string field", "str: base64-encoded ciphertext, or None if empty input"],
    ["decrypt_field(ciphertext)", "FERNET_KEY", "Decrypts a string field", "str: plaintext, or '[decryption failed]' on any error"],
    ["generate_token(data, salt)", "SECRET_KEY", "Creates signed URL-safe token", "str: signed token"],
    ["verify_token(token, salt, max_age)", "SECRET_KEY", "Verifies and decodes a signed token", "data dict, or None if expired/invalid (default max_age=86400s)"],
  ], [2800, 1400, 2600, 2560]),

  infoBox("CRITICAL: If FERNET_KEY is changed or lost, ALL encrypted fields become permanently unreadable. This includes: guardian phone numbers, document encryption keys, meeting addresses, whiteboard snapshots, session note attachments, recording encryption keys.", "danger"),

  h2("Encryption Map (Fields Using encrypt_field)"),
  makeTable(["Model", "Field", "Encrypted At", "Decrypted At"], [
    ["Guardian", "_phone_encrypted", "phone setter property", "phone getter property"],
    ["TutorDocument", "file_encryption_key", "upload_document()", "download_document()"],
    ["Booking", "meeting_address_encrypted", "book_session() for home addresses", "Session room template"],
    ["WhiteboardSession", "snapshots[].encryption_key", "Whiteboard save", "Whiteboard view"],
    ["SessionNote", "attachments[].encryption_key", "Note attachment upload", "Note attachment download"],
    ["SessionRecording", "file_encryption_key", "Recording save", "Recording playback"],
  ], [2200, 2400, 2400, 2360]),
]));

// ═══════════════════════════════════════════════════════
// SECTION 18: config.py
// ═══════════════════════════════════════════════════════
sections.push(buildSection("config.py", [
  h1("18. config.py (config.py)"),
  h2("Overview"),
  para("Central configuration class. Loads environment variables via python-dotenv. Defines all config values with sensible defaults. TestConfig subclass overrides for testing with in-memory SQLite and disabled rate limiting."),

  h2("Environment Variables"),
  makeTable(["Variable", "Config Key", "Default", "Category", "Risk If Missing"], [
    ["SECRET_KEY", "SECRET_KEY", "'dev-fallback-change-me'", "Flask Core", "Session cookies predictable — MUST change in production"],
    ["DATABASE_URL", "SQLALCHEMY_DATABASE_URI", "sqlite:///teachwise.db", "Database", "Falls back to SQLite — no production use"],
    ["RESEND_API_KEY", "RESEND_API_KEY", "''", "Email", "All emails skipped"],
    ["FERNET_KEY", "FERNET_KEY", "''", "Encryption", "Encryption/decryption fails — data loss"],
    ["REDIS_URL", "REDIS_URL", "''", "Cache/Events", "No caching, no events, no Celery"],
    ["STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY", "'sk_test_placeholder'", "Payments", "All Stripe API calls fail"],
    ["STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET", "'whsec_placeholder'", "Payments", "Webhooks fail signature verification"],
    ["R2_ENDPOINT_URL", "R2_ENDPOINT_URL", "''", "Storage", "Falls back to local storage"],
    ["R2_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID", "''", "Storage", "Falls back to local storage"],
    ["R2_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY", "''", "Storage", "Falls back to local storage"],
    ["OPENAI_API_KEY", "OPENAI_API_KEY", "''", "Chatbot", "Chatbot responses fail"],
    ["JWT_SECRET_KEY", "JWT_SECRET_KEY", "= SECRET_KEY", "Microservices", "Defaults to SECRET_KEY"],
  ], [2000, 2200, 1800, 1200, 2160]),

  h2("Hardcoded Configuration"),
  makeTable(["Key", "Value", "Description"], [
    ["PLATFORM_FEE_PERCENT", "15", "Platform takes 15% of every payment"],
    ["MAX_CONTENT_LENGTH", "10MB", "Max upload size for any request"],
    ["DOC_MAX_SIZE_MB", "5", "Max document upload size"],
    ["DOC_RETENTION_DAYS", "90", "Days to keep verified tutor documents"],
    ["CACHE_TTL", "900 (15 min)", "Default Redis cache TTL"],
    ["REC_WEIGHT_SUBJECT", "0.40", "Recommendation: subject relevance weight"],
    ["REC_WEIGHT_RATING", "0.25", "Recommendation: rating weight"],
    ["REC_WEIGHT_DISTANCE", "0.20", "Recommendation: proximity weight"],
    ["REC_WEIGHT_EXPERIENCE", "0.10", "Recommendation: experience weight"],
    ["REC_WEIGHT_AVAILABILITY", "0.05", "Recommendation: slot availability weight"],
    ["RATELIMIT_LOGIN", "'10 per 15 minutes'", "Login rate limit"],
    ["WALLET_MIN_TOPUP / MAX_TOPUP", "5 / 500", "Wallet top-up bounds"],
  ], [2800, 1600, 4960]),
]));

// ═══════════════════════════════════════════════════════
// SECTION 19: Models Overview
// ═══════════════════════════════════════════════════════
sections.push(buildSection("models/*.py", [
  h1("19. Models (models/*.py)"),
  h2("Overview"),
  para("The TeachWise data layer consists of 29 SQLAlchemy models across 28 files. All models inherit from db.Model. User models (Student, Tutor, Guardian, Admin) also inherit from UserMixin for Flask-Login. The models use PostgreSQL in production and SQLite for testing."),

  h2("Core Entity Models"),
  makeTable(["Model", "Table", "Primary Relationships", "Key Fields"], [
    ["Student", "students", "bookings, reviews, conversations, favorites, wallet, learning_goals, saved_locations", "name, email, password, date_of_birth, guardian_id, email_verified, notification_prefs"],
    ["Tutor", "tutors", "slots, reviews, assignments_given, conversations, documents, guardian_messages", "name, email, subject, hourly_rate, verification_status, stripe_account_id, rating_avg"],
    ["Guardian", "guardians", "students, messages_sent", "name, email, _phone_encrypted (Fernet), relationship, password_hash, is_verified"],
    ["Admin", "admins", "(none)", "name, email, password, role (reviewer/verification_officer/admin/superadmin)"],
  ], [1200, 1200, 3600, 3360]),

  h2("Booking & Payment Models"),
  makeTable(["Model", "Table", "Key Fields", "Status Values"], [
    ["Booking", "bookings", "student_id, tutor_id, slot_id, confirmation_email_sent, guardian_approved, meeting_address_encrypted", "Booked → Pending Payment → Confirmed → Completed | Cancelled"],
    ["TutorSlot", "tutor_slots", "date, start_time, end_time, mode, price, is_group, max_students, jitsi_room_name, location_*", "pending → booked → live → completed | cancelled"],
    ["Payment", "payments", "booking_id, amount, platform_fee, tutor_payout, stripe_checkout_session_id, stripe_payment_intent_id, refund_amount", "pending → completed → refunded | partial_refund | failed"],
    ["Wallet", "wallets", "student_id (unique), balance, currency", "—"],
    ["WalletTransaction", "wallet_transactions", "wallet_id, amount, type (topup/booking_payment/refund/bonus), balance_after", "—"],
    ["RefundRequest", "refund_requests", "payment_id, student_id, reason, refund_percentage, refund_amount", "pending → approved | denied"],
  ], [1600, 1200, 3600, 2960]),

  h2("Communication Models"),
  makeTable(["Model", "Table", "Key Fields"], [
    ["Conversation", "conversations", "student_id + tutor_id (unique pair), is_blocked_by_student, is_blocked_by_tutor"],
    ["Message", "messages", "conversation_id, sender_type, content, status (sent→delivered→read), message_type (text/image/file), file_url"],
    ["GuardianMessage", "guardian_messages", "guardian_id, tutor_id, student_id, sender_type, content, is_read"],
    ["InAppNotification", "in_app_notifications", "user_id, user_type, type, title, message, url, is_read, group_key, count"],
    ["EmailNotification", "email_notifications", "recipient_email, email_type, status (queued/sent/failed/skipped), error_message"],
  ], [2200, 1600, 5560]),

  h2("Learning & Content Models"),
  makeTable(["Model", "Table", "Key Fields"], [
    ["Assignment", "assignments", "tutor_id, student_id, title, due_date, status, rubric (JSON), allow_late_submission, allow_resubmission"],
    ["Submission", "submissions", "assignment_id, text_response, file_urls (JSON), grade, rubric_scores (JSON), is_late, resubmission_count"],
    ["LearningGoal", "learning_goals", "student_id, tutor_id, title, status (active/completed/paused), skill_tags (JSON)"],
    ["ProgressEntry", "progress_entries", "goal_id, slot_id, note, rating (1-5)"],
    ["SessionNote", "session_notes", "slot_id, author_type, content, is_private, attachments (JSON)"],
    ["NoteVersion", "note_versions", "note_id, content, edited_by — tracks edit history"],
    ["WhiteboardSession", "whiteboard_sessions", "slot_id, json_state (Fabric.js canvas), thumbnail (base64), snapshots (JSON)"],
    ["SessionRecording", "session_recordings", "slot_id, r2_object_key, file_encryption_key, consent_student, consent_tutor, expires_at"],
  ], [2000, 1600, 5760]),

  h2("Review & Moderation Models"),
  makeTable(["Model", "Table", "Key Fields"], [
    ["Review", "reviews", "student_id, tutor_id, rating (1-5), rating_knowledge/communication/punctuality/value, tutor_response"],
    ["ReviewReport", "review_reports", "review_id, reporter_id, reason (spam/inappropriate/fake/other), status"],
    ["ReviewVote", "review_votes", "review_id, voter_id, is_helpful — unique constraint on (review_id, voter_id, voter_type)"],
    ["ContentReport", "content_reports", "reporter_id, content_type (review/note/profile), content_id, reason, status"],
    ["AuditLog", "audit_logs", "admin_id, action, target_type, target_id, details (JSON), ip_address"],
  ], [2000, 1600, 5760]),

  h2("Other Models"),
  makeTable(["Model", "Table", "Key Fields"], [
    ["RescheduleRequest", "reschedule_requests", "booking_id, original_slot_id, proposed_slot_id, requested_by, expires_at (48h default)"],
    ["FavoriteTutor", "favorite_tutors", "student_id, tutor_id — unique constraint"],
    ["TutorDocument", "tutor_documents", "tutor_id, document_type, r2_object_key, file_encryption_key, verification_hash, status, expiry_date"],
    ["StudentSavedLocation", "student_saved_locations", "student_id, label, address, lat/lng, location_type, is_primary"],
    ["PlatformSetting", "platform_settings", "key (unique), value, category — static get/set methods"],
    ["ChatbotConversation", "chatbot_conversations", "UUID primary key, user_id, user_role, status, message_count, total_tokens"],
    ["ChatbotMessage", "chatbot_messages", "UUID primary key, conversation_id, role, content, tool_calls (JSON), tokens_used, feedback"],
  ], [2000, 1600, 5760]),

  h2("Notable Model Features"),
  bullet("Student.is_minor: Computed property — calculates age from date_of_birth on every access."),
  bullet("Student.guardian_verified: True if adult, or if minor with verified guardian."),
  bullet("Guardian.phone: Property with Fernet encrypt/decrypt. Reads FERNET_KEY from Flask config on every access."),
  bullet("Tutor.average_rating: Computed from all reviews (not cached rating_avg). May differ from rating_avg."),
  bullet("PlatformSetting: Static get/set methods with auto-create. set() calls db.session.commit() internally."),
  bullet("SessionRecording.is_expired: Computed property comparing expires_at to utcnow()."),
]));

module.exports = sections;
