#!/usr/bin/env node
/**
 * TeachWise Architecture Document Generator
 * Generates a comprehensive .docx architecture document
 */

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, PageBreak, LevelFormat,
  TableBorders, convertInchesToTwip,
} = require("docx");
const fs = require("fs");
const path = require("path");

// ── Helpers ──────────────────────────────────────────────────────────
const BLUE = "1E3A5F";
const DARK = "1F2937";
const GRAY = "6B7280";
const LIGHT_BG = "F0F4F8";
const ACCENT = "2563EB";
const WHITE = "FFFFFF";
const GREEN = "059669";
const ORANGE = "D97706";

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: BLUE, font: "Calibri" })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, size: 26, color: DARK, font: "Calibri" })],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, color: ACCENT, font: "Calibri" })],
  });
}

function body(text) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 20, font: "Calibri", color: DARK })],
  });
}

function bodyBold(label, text) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({ text: label, bold: true, size: 20, font: "Calibri", color: DARK }),
      new TextRun({ text, size: 20, font: "Calibri", color: DARK }),
    ],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 20, font: "Calibri", color: DARK })],
  });
}

function bulletBold(label, text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 60 },
    children: [
      new TextRun({ text: label, bold: true, size: 20, font: "Calibri", color: DARK }),
      new TextRun({ text, size: 20, font: "Calibri", color: DARK }),
    ],
  });
}

function codeBlock(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    shading: { type: ShadingType.SOLID, color: "F3F4F6" },
    indent: { left: 360 },
    children: [new TextRun({ text, size: 18, font: "Consolas", color: "374151" })],
  });
}

function spacer() {
  return new Paragraph({ spacing: { after: 100 }, children: [] });
}

function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" } },
    children: [],
  });
}

const noBorders = {
  top: { style: BorderStyle.NONE },
  bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
  insideVertical: { style: BorderStyle.NONE },
};

function makeTable(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(h =>
      new TableCell({
        shading: { type: ShadingType.SOLID, color: BLUE },
        children: [new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [new TextRun({ text: h, bold: true, size: 18, color: WHITE, font: "Calibri" })],
        })],
      })
    ),
  });

  const dataRows = rows.map((row, idx) =>
    new TableRow({
      children: row.map(cell =>
        new TableCell({
          shading: idx % 2 === 0 ? { type: ShadingType.SOLID, color: "F9FAFB" } : undefined,
          children: [new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: cell, size: 18, font: "Calibri", color: DARK })],
          })],
        })
      ),
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [headerRow, ...dataRows],
  });
}

// ── Cover Page ───────────────────────────────────────────────────────
function coverPage() {
  return {
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      spacer(), spacer(), spacer(), spacer(), spacer(), spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: "TeachWise", bold: true, size: 56, color: BLUE, font: "Calibri" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: "Architecture Document", size: 36, color: DARK, font: "Calibri" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: ACCENT } },
        children: [new TextRun({ text: "Online Tutoring Platform", size: 24, color: GRAY, font: "Calibri" })],
      }),
      spacer(), spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "Version 1.0", size: 22, color: GRAY, font: "Calibri" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "March 13, 2026", size: 22, color: GRAY, font: "Calibri" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "Classification: Internal", size: 20, color: GRAY, font: "Calibri" })],
      }),
    ],
  };
}

// ── Section 1: Executive Summary ─────────────────────────────────────
function section1() {
  return {
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      heading1("1. Executive Summary"),
      body("TeachWise is a full-featured online tutoring marketplace that connects students with qualified tutors across 24 subject categories and 850+ topics. The platform supports four distinct user roles (Student, Tutor, Admin, Guardian), real-time video sessions via Jitsi Meet, an AI-powered chatbot, Stripe payment processing, and comprehensive scheduling with geospatial search capabilities."),
      spacer(),
      body("The application is built on Flask 2.3.3 with a PostgreSQL database, Redis caching layer, and real-time WebSocket communication via Flask-SocketIO. It follows a modular blueprint architecture with 20 route modules, 35 data models, and a microservice-ready design for horizontal scaling."),
      spacer(),
      heading2("1.1 Key Platform Metrics"),
      makeTable(["Metric", "Value"], [
        ["User Roles", "4 (Student, Tutor, Admin, Guardian)"],
        ["Subject Categories", "24"],
        ["Subcategories", "110"],
        ["Topics", "850+"],
        ["Route Modules", "20 (150+ endpoints)"],
        ["Data Models", "35"],
        ["Template Files", "81"],
        ["Service Modules", "20+"],
        ["Database Migrations", "28"],
        ["Total Codebase", "~45,000+ lines"],
      ]),
      spacer(),
      heading2("1.2 Core Capabilities"),
      bullet("Multi-role authentication with role-based access control (RBAC)"),
      bullet("Real-time video tutoring sessions with Jitsi Meet integration"),
      bullet("AI-powered chatbot with OpenAI GPT-4o and function calling"),
      bullet("Stripe payment processing with wallet system and refund management"),
      bullet("Geospatial tutor search with PostGIS and recommendation engine"),
      bullet("Real-time chat, whiteboard collaboration, and notifications via SocketIO"),
      bullet("Guardian/parental oversight with spending limits and activity monitoring"),
      bullet("Assignment management with rubric-based grading and auto-save"),
      bullet("Session recording with dual consent and encrypted storage"),
      bullet("Comprehensive admin dashboard with analytics, moderation, and audit logging"),
    ],
  };
}

// ── Section 2: Technology Stack ──────────────────────────────────────
function section2() {
  return {
    children: [
      heading1("2. Technology Stack"),

      heading2("2.1 Backend"),
      makeTable(["Component", "Technology", "Version"], [
        ["Web Framework", "Flask", "2.3.3"],
        ["WSGI Server", "Gunicorn", "22.0.0"],
        ["Database ORM", "Flask-SQLAlchemy", "3.0.5"],
        ["Database Migrations", "Flask-Migrate (Alembic)", "4.0.5"],
        ["Authentication", "Flask-Login", "0.6.3"],
        ["WebSocket", "Flask-SocketIO", "5.6.1"],
        ["Task Queue", "Celery", "5.4.0"],
        ["Rate Limiting", "Flask-Limiter", "3.5.1"],
        ["CSRF Protection", "Flask-WTF", "1.2.1"],
        ["HTTP Server", "Werkzeug", "2.3.7"],
        ["Async Mode", "gevent", "24.2.1"],
        ["JWT Tokens", "PyJWT", "2.8.0"],
      ]),
      spacer(),

      heading2("2.2 Database & Storage"),
      makeTable(["Component", "Technology", "Purpose"], [
        ["Primary Database", "PostgreSQL 14/17", "Relational data storage"],
        ["Spatial Extension", "PostGIS (GeoAlchemy2 0.15.2)", "Geospatial queries and distance calculations"],
        ["Caching & Sessions", "Redis (Upstash)", "Session store, search cache, rate limit counters"],
        ["Object Storage", "Cloudflare R2", "Document uploads, recordings, attachments"],
        ["Encryption", "Fernet (cryptography 42.0.5)", "Sensitive field encryption (phone, addresses)"],
      ]),
      spacer(),

      heading2("2.3 Frontend"),
      makeTable(["Component", "Technology", "Purpose"], [
        ["Template Engine", "Jinja2", "Server-side HTML rendering"],
        ["CSS Framework", "Tailwind CSS", "Utility-first styling"],
        ["Icons", "Font Awesome 6", "UI icons"],
        ["Charts", "Chart.js 4.4.0", "Analytics and progress visualization"],
        ["Calendar", "FullCalendar 6.1.9", "Tutor availability scheduling"],
        ["Maps", "Leaflet.js", "Location picker and search maps"],
        ["Whiteboard", "Fabric.js 5.3.0", "Collaborative drawing canvas"],
        ["Rich Text", "Quill.js 2.0.2", "Rich text editing for notes"],
        ["Image Cropping", "Cropper.js 1.6.1", "Profile photo cropping"],
        ["Onboarding", "Shepherd.js 11.2.0", "Guided user tours"],
        ["Sliders", "noUiSlider 15.7.1", "Price/distance range filters"],
        ["WebSocket Client", "Socket.IO", "Real-time communication"],
      ]),
      spacer(),

      heading2("2.4 External Services"),
      makeTable(["Service", "Provider", "Purpose"], [
        ["Payments", "Stripe", "Checkout, Connect, webhooks, refunds"],
        ["Email", "Resend.com", "Transactional emails (3,000/month free tier)"],
        ["AI/LLM", "OpenAI (GPT-4o)", "Chatbot conversations with function calling"],
        ["Video Conferencing", "Jitsi Meet", "Live tutoring video sessions"],
        ["Geocoding", "Nominatim (OpenStreetMap)", "Address-to-coordinates conversion"],
        ["Reverse Proxy", "Nginx", "Production request routing and SSL termination"],
        ["Containerization", "Docker / Docker Compose", "Multi-container orchestration"],
      ]),
    ],
  };
}

// ── Section 3: System Architecture ──────────────────────────────────
function section3() {
  return {
    children: [
      heading1("3. System Architecture"),

      heading2("3.1 High-Level Architecture"),
      body("TeachWise follows a monolithic-first architecture with microservice-ready components. The core Flask application handles all user-facing routes, while specialized services (search, chat, notifications, learning) can be deployed as independent microservices when scaling demands require it."),
      spacer(),

      codeBlock("  Browser / Mobile"),
      codeBlock("       |"),
      codeBlock("   [Nginx Reverse Proxy]"),
      codeBlock("       |"),
      codeBlock("  [Gunicorn + Flask App]  <-->  [Redis]  <-->  [Celery Workers]"),
      codeBlock("       |                           |"),
      codeBlock("  [PostgreSQL + PostGIS]     [Cloudflare R2]"),
      codeBlock("       |"),
      codeBlock("  [External APIs: Stripe, OpenAI, Resend, Nominatim, Jitsi]"),
      spacer(),

      heading2("3.2 Application Layer Architecture"),
      body("The Flask application is organized into distinct layers:"),
      spacer(),

      heading3("3.2.1 Presentation Layer"),
      bullet("81 Jinja2 HTML templates organized by user role"),
      bullet("Tailwind CSS with custom animations (shimmer, pulse-glow, wave, breathe)"),
      bullet("JavaScript modules for interactivity (notifications, chat, location picker, toast)"),
      bullet("Responsive design with mobile-first approach"),
      bullet("Dark mode support with localStorage persistence"),
      bullet("ARIA accessibility (live regions, skip links, focus states)"),
      spacer(),

      heading3("3.2.2 Route/Controller Layer"),
      bullet("20 Flask blueprints with URL prefixing"),
      bullet("Role-based access control via @role_required decorator"),
      bullet("Rate limiting on sensitive endpoints (login, registration, API calls)"),
      bullet("CSRF protection on all form submissions"),
      bullet("Input validation and HTML sanitization"),
      spacer(),

      heading3("3.2.3 Service Layer"),
      bullet("Business logic separated from routes (search, payment, booking, email, etc.)"),
      bullet("Async task processing via Celery (email delivery, background jobs)"),
      bullet("Scheduled tasks via APScheduler (reminders, cleanup, cache invalidation)"),
      bullet("Inter-service communication via Redis event bus and HTTP/JWT"),
      spacer(),

      heading3("3.2.4 Data Access Layer"),
      bullet("SQLAlchemy ORM with 35 model classes"),
      bullet("Flask-Migrate (Alembic) for schema versioning with 28 migrations"),
      bullet("Redis caching with pattern-based invalidation"),
      bullet("Cloudflare R2 for binary object storage (S3-compatible API)"),
      spacer(),

      heading2("3.3 Request Flow"),
      body("A typical authenticated request follows this path:"),
      bullet("Browser sends HTTPS request to Nginx"),
      bullet("Nginx proxies to Gunicorn (gevent worker)"),
      bullet("Flask-Login validates session (Redis-backed) and loads user"),
      bullet("Rate limiter checks request count"),
      bullet("CSRF token validated for POST/PUT/DELETE"),
      bullet("Route handler executes business logic"),
      bullet("SQLAlchemy queries PostgreSQL"),
      bullet("Redis checked for cached data"),
      bullet("Jinja2 renders template with context"),
      bullet("Security headers injected (CSP, HSTS, X-Frame-Options)"),
      bullet("Response returned through Nginx to browser"),
    ],
  };
}

// ── Section 4: Data Model ────────────────────────────────────────────
function section4() {
  return {
    children: [
      heading1("4. Data Model"),

      heading2("4.1 Entity Overview"),
      body("The database contains 35 SQLAlchemy models organized into logical domains:"),
      spacer(),

      heading3("User Models (4)"),
      makeTable(["Model", "Table", "Key Fields"], [
        ["Student", "students", "name, email, password, date_of_birth, guardian_id, latitude, longitude, notification_prefs, timezone"],
        ["Tutor", "tutors", "name, email, subject, subjects_additional, hourly_rate, verification_status, rating_avg, stripe_account_id, service_radius_km"],
        ["Guardian", "guardians", "name, email, _phone_encrypted, relationship, weekly/monthly_spending_limit, child_notification_config"],
        ["Admin", "admins", "name, email, password, role (reviewer/verification_officer/admin/superadmin)"],
      ]),
      spacer(),

      heading3("Booking & Session Models (3)"),
      makeTable(["Model", "Table", "Key Fields"], [
        ["TutorSlot", "tutor_slots", "tutor_id, student_id, date, start_time, end_time, mode, subject, price, status, jitsi_room_name, location_*"],
        ["Booking", "bookings", "student_id, tutor_id, slot_id, status, recording_consent_*, meeting_address_encrypted, guardian_approved"],
        ["RescheduleRequest", "reschedule_requests", "booking_id, original_slot_id, proposed_slot_id, requested_by, status, expires_at"],
      ]),
      spacer(),

      heading3("Communication Models (5)"),
      makeTable(["Model", "Table", "Key Fields"], [
        ["Conversation", "conversations", "student_id, tutor_id, is_blocked_by_*, last_message_at"],
        ["Message", "messages", "conversation_id, sender_type, content, status (sent/delivered/read), message_type (text/image/file)"],
        ["GuardianMessage", "guardian_messages", "guardian_id, tutor_id, student_id, sender_type, content"],
        ["ChatbotConversation", "chatbot_conversations", "user_id, user_role, status, message_count, total_tokens"],
        ["ChatbotMessage", "chatbot_messages", "conversation_id, role, content, tool_calls, tool_results, tokens_used"],
      ]),
      spacer(),

      heading3("Academic Models (4)"),
      makeTable(["Model", "Table", "Key Fields"], [
        ["Assignment", "assignments", "tutor_id, student_id, title, due_date, rubric (JSON), allow_late_submission, max_resubmissions"],
        ["Submission", "submissions", "assignment_id, student_id, text_response, file_urls, grade, rubric_scores (JSON), resubmission_count"],
        ["LearningGoal", "learning_goals", "student_id, tutor_id, title, status, target_date, skill_tags (JSON)"],
        ["ProgressEntry", "progress_entries", "goal_id, slot_id, note, rating (1-5), created_by"],
      ]),
      spacer(),

      heading3("Review & Feedback Models (3)"),
      makeTable(["Model", "Table", "Key Fields"], [
        ["Review", "reviews", "student_id, tutor_id, booking_id, rating, rating_knowledge/communication/punctuality/value, comment, tutor_response"],
        ["ReviewReport", "review_reports", "review_id, reporter_id, reason (spam/inappropriate/fake/other), status"],
        ["ReviewVote", "review_votes", "review_id, voter_id, is_helpful"],
      ]),
      spacer(),

      heading3("Session Documentation Models (4)"),
      makeTable(["Model", "Table", "Key Fields"], [
        ["SessionNote", "session_notes", "slot_id, author_type, content, is_private, attachments (JSON)"],
        ["NoteVersion", "note_versions", "note_id, content, edited_by"],
        ["SessionRecording", "session_recordings", "slot_id, r2_object_key, file_encryption_key, quality, consent_*, expires_at"],
        ["WhiteboardSession", "whiteboard_sessions", "slot_id, json_state, thumbnail, snapshots (JSON)"],
      ]),
      spacer(),

      heading3("Financial Models (4)"),
      makeTable(["Model", "Table", "Key Fields"], [
        ["Payment", "payments", "booking_id, amount, platform_fee (15%), tutor_payout, stripe_*, status, refund_amount"],
        ["RefundRequest", "refund_requests", "payment_id, student_id, reason, refund_percentage, status (pending/approved/denied)"],
        ["Wallet", "wallets", "student_id, balance, currency"],
        ["WalletTransaction", "wallet_transactions", "wallet_id, amount, type (topup/booking_payment/refund/bonus), balance_after"],
      ]),
      spacer(),

      heading3("Notification Models (2)"),
      makeTable(["Model", "Table", "Key Fields"], [
        ["InAppNotification", "in_app_notifications", "user_id, user_type, type, title, message, icon, color, url, group_key, is_read"],
        ["EmailNotification", "email_notifications", "recipient_email, email_type, subject_line, status (queued/sent/failed), sent_at"],
      ]),
      spacer(),

      heading3("Admin & System Models (3)"),
      makeTable(["Model", "Table", "Key Fields"], [
        ["AuditLog", "audit_logs", "admin_id, action, target_type, target_id, details (JSON), ip_address"],
        ["ContentReport", "content_reports", "reporter_id, content_type, content_id, reason, status"],
        ["PlatformSetting", "platform_settings", "key (unique), value, category, updated_by"],
      ]),
      spacer(),

      heading3("Utility Models (3)"),
      makeTable(["Model", "Table", "Key Fields"], [
        ["FavoriteTutor", "favorite_tutors", "student_id, tutor_id (unique together)"],
        ["StudentSavedLocation", "student_saved_locations", "student_id, label, address, latitude, longitude, is_primary"],
        ["TutorDocument", "tutor_documents", "tutor_id, document_type, r2_object_key, file_encryption_key, verification_hash, status, expiry_date"],
      ]),
      spacer(),

      heading2("4.2 Key Design Patterns"),
      bulletBold("User Polymorphism: ", "All 4 user types implement user_type property and get_id() returning '{type}_{id}' format"),
      bulletBold("Encrypted Fields: ", "Guardian phone and booking meeting addresses use Fernet encryption"),
      bulletBold("JSON Columns: ", "Complex data (rubrics, notification prefs, attachments, skill tags) stored as JSON"),
      bulletBold("Status State Machines: ", "Bookings, payments, documents, and reviews follow defined status transitions"),
      bulletBold("Soft Deletes: ", "Messages and recordings use is_deleted flags rather than hard deletes"),
      bulletBold("Version History: ", "Session notes maintain full edit history via NoteVersion table"),
      bulletBold("Cascading Deletes: ", "ChatbotMessages cascade-delete with their parent conversation"),
    ],
  };
}

// ── Section 5: Authentication & Authorization ─────────────────────────
function section5() {
  return {
    children: [
      heading1("5. Authentication & Authorization"),

      heading2("5.1 Authentication Flow"),
      body("TeachWise uses Flask-Login for session-based authentication with Redis-backed server-side sessions. Each user role has a separate login endpoint and registration flow."),
      spacer(),

      heading3("Login Endpoints"),
      makeTable(["Role", "Login URL", "Registration URL"], [
        ["Student", "/student/login", "/student/register"],
        ["Tutor", "/tutor/login", "/tutor/register"],
        ["Admin", "/admin/login", "(Created by superadmin)"],
        ["Guardian", "/guardian/login", "(Invited by student registration)"],
      ]),
      spacer(),

      heading3("User Identification"),
      body("Flask-Login's user_loader callback identifies users by a composite ID format: '{user_type}_{id}'. The callback queries the appropriate model table (Student, Tutor, Admin, or Guardian) based on the prefix. User objects are cached in Redis for 300 seconds to reduce database lookups."),
      spacer(),

      heading2("5.2 Security Measures"),
      bulletBold("Password Policy: ", "Minimum 12 characters, requires uppercase, digit, and special character"),
      bulletBold("Account Lockout: ", "5 failed login attempts triggers a 15-minute lockout"),
      bulletBold("Rate Limiting: ", "Login endpoints limited to 10 requests per 15 minutes"),
      bulletBold("Registration Rate Limiting: ", "5 per hour to prevent abuse"),
      bulletBold("Email Verification: ", "Required for students; token expires in 24 hours"),
      bulletBold("Guardian Verification: ", "Token-based invitation with 48-hour expiry"),
      bulletBold("Password Reset: ", "Token-based flow with 1-hour expiry"),
      bulletBold("CSRF Protection: ", "Flask-WTF CSRF tokens on all forms"),
      bulletBold("Session Security: ", "Redis-backed sessions with 30-day lifetime, httponly cookies"),
      spacer(),

      heading2("5.3 Role-Based Access Control"),
      body("The @role_required decorator restricts route access by user type:"),
      spacer(),
      codeBlock("@role_required('tutor')"),
      codeBlock("def tutor_dashboard():"),
      codeBlock("    # Only accessible by authenticated tutors"),
      spacer(),

      heading2("5.4 Security Headers"),
      body("All responses include hardened security headers:"),
      bullet("Content-Security-Policy (CSP) with strict source whitelisting"),
      bullet("X-Frame-Options: SAMEORIGIN"),
      bullet("Strict-Transport-Security (HSTS) with 1-year max-age"),
      bullet("X-Content-Type-Options: nosniff"),
      bullet("X-XSS-Protection: 1; mode=block"),
      bullet("Referrer-Policy: strict-origin-when-cross-origin"),

      spacer(),
      heading2("5.5 Microservice Authentication"),
      body("Internal service-to-service calls use JWT tokens with role='internal'. The @internal_only decorator validates these tokens on the /api/internal/* endpoints."),
    ],
  };
}

// ── Section 6: API & Routes ──────────────────────────────────────────
function section6() {
  return {
    children: [
      heading1("6. API & Route Architecture"),

      heading2("6.1 Blueprint Organization"),
      body("The application is organized into 20 Flask blueprints, each handling a specific domain:"),
      spacer(),

      makeTable(["Blueprint", "Prefix", "Purpose", "Endpoints"], [
        ["student_bp", "(none)", "Student auth, dashboard, bookings, favorites, locations", "~25"],
        ["tutor_bp", "(none)", "Tutor auth, profile, availability, earnings, students", "~30"],
        ["admin_bp", "/admin", "Admin dashboard, user management, analytics, moderation", "~20"],
        ["guardian_bp", "/guardian", "Guardian auth, child monitoring, spending limits, messaging", "~15"],
        ["session_bp", "(none)", "Video session join/end, summary, receipts", "~6"],
        ["chat_bp", "(none)", "Real-time chat, conversations, file upload, message edit", "~12"],
        ["payment_bp", "(none)", "Stripe checkout, webhooks, invoices, refunds", "~8"],
        ["wallet_bp", "(none)", "Wallet balance, top-up, transactions", "~4"],
        ["search_bp", "(none)", "Tutor search, autocomplete, recent searches", "~5"],
        ["assignment_bp", "(none)", "Assignment creation, submission, review, auto-save", "~8"],
        ["progress_bp", "(none)", "Learning goals, progress entries, PDF reports", "~10"],
        ["note_bp", "(none)", "Session notes, version history, attachments", "~7"],
        ["recording_bp", "(none)", "Recording consent, upload, playback, expiry", "~8"],
        ["whiteboard_bp", "(none)", "Whiteboard state, snapshots, collaboration", "~5"],
        ["reschedule_bp", "(none)", "Reschedule requests, approve/reject, bulk actions", "~7"],
        ["notif_center_bp", "(none)", "Notification center, preferences, push, digests", "~9"],
        ["notification_bp", "(none)", "Notification API endpoint", "~1"],
        ["doc_bp", "(none)", "Document upload, verification, admin review", "~5"],
        ["geocoding_bp", "/api/geocode", "Forward/reverse geocoding", "~2"],
        ["internal_bp", "/api/internal", "Service-to-service API (JWT auth)", "~7"],
      ]),
      spacer(),

      heading2("6.2 Real-Time Events (Socket.IO)"),
      body("Flask-SocketIO handles real-time communication for three features:"),
      spacer(),

      heading3("Chat Events"),
      bullet("join_conversation / leave_conversation - Room management"),
      bullet("typing_start / typing_stop - Typing indicators"),
      bullet("message_received - Real-time message delivery"),
      bullet("mark_read - Read receipt updates"),
      spacer(),

      heading3("Session Events"),
      bullet("join_session / leave_session - Session room management"),
      bullet("session_pause / session_resume - Session state control"),
      bullet("session_note_saved - Note sync notifications"),
      spacer(),

      heading3("Whiteboard Events"),
      bullet("join_whiteboard / leave_whiteboard - Whiteboard room management"),
      bullet("whiteboard_draw - Real-time drawing sync"),
      bullet("whiteboard_clear / whiteboard_undo - Canvas operations"),
      spacer(),

      heading2("6.3 Rate Limiting Strategy"),
      makeTable(["Endpoint", "Limit", "Window"], [
        ["Global default", "200 requests", "Per hour"],
        ["Login (all roles)", "10 requests", "Per 15 minutes"],
        ["Registration", "5 requests", "Per hour"],
        ["Forgot password", "3 requests", "Per hour"],
        ["Chat API send", "60 requests", "Per minute"],
        ["File upload", "20 requests", "Per minute"],
        ["Search", "30 requests", "Per minute"],
        ["Search suggestions", "60 requests", "Per minute"],
        ["Geocoding", "10 requests", "Per minute"],
        ["Document upload", "10 requests", "Per hour"],
      ]),
    ],
  };
}

// ── Section 7: Feature Modules ───────────────────────────────────────
function section7() {
  return {
    children: [
      heading1("7. Feature Modules"),

      heading2("7.1 Search & Discovery"),
      bullet("Full-text search using PostgreSQL text search vectors"),
      bullet("Geospatial search with PostGIS (ST_Distance, ST_DWithin, ST_MakePoint)"),
      bullet("Multi-subject filtering with rating, price, experience, and mode filters"),
      bullet("Recommendation engine with weighted scoring (subject: 40%, rating: 25%, distance: 20%, experience: 10%, availability: 5%)"),
      bullet("Autocomplete suggestions with debounced input"),
      bullet("Recent search history per user"),
      bullet("Redis caching with MD5-hashed cache keys"),
      bullet("Leaflet.js map integration with tutor location pins"),
      spacer(),

      heading2("7.2 Booking & Scheduling"),
      bullet("Tutors create time slots with date, start/end time, subject, price, and mode"),
      bullet("Students browse and book available slots"),
      bullet("Guardian approval required for minor students"),
      bullet("FullCalendar 6.1.9 for visual schedule management"),
      bullet("Reschedule support (max 2 per booking, 6+ hours before session)"),
      bullet("Cancellation with refund policy (24h: 100%, 12-24h: 50%, <12h: 0%)"),
      bullet("24-hour and 1-hour reminder emails via Celery"),
      bullet("In-person booking with location picker and encrypted address storage"),
      spacer(),

      heading2("7.3 Video Sessions"),
      bullet("Jitsi Meet integration for live video conferencing"),
      bullet("Time-gated entry (join 15 min before to 30 min after start)"),
      bullet("Session pause/resume via Socket.IO"),
      bullet("Post-session summary with quick feedback"),
      bullet("PDF receipt generation (fpdf2)"),
      bullet("Integrated whiteboard (Fabric.js) with real-time collaboration"),
      bullet("Session recording with dual consent requirement"),
      bullet("Recording quality presets (360p, 720p, 1080p)"),
      bullet("Encrypted recording storage with 30-day expiry"),
      spacer(),

      heading2("7.4 Payments & Wallet"),
      bullet("Stripe Checkout Sessions for payment processing"),
      bullet("Stripe Connect for tutor onboarding and payouts"),
      bullet("15% platform fee on all transactions"),
      bullet("Wallet system for student prepayment and balance management"),
      bullet("Wallet top-up via Stripe"),
      bullet("PDF invoice generation"),
      bullet("Self-service refund requests with admin approval workflow"),
      bullet("Webhook integration for payment event processing"),
      spacer(),

      heading2("7.5 AI Chatbot"),
      bullet("OpenAI GPT-4o with 1024 max token responses"),
      bullet("10 function calling tools (user profile, bookings, search, refund calculation, cancellation, escalation)"),
      bullet("Up to 5 tool call rounds per message"),
      bullet("Rate limiting: 30 messages per 10-minute window per conversation"),
      bullet("Auto-escalation at 100K tokens per conversation"),
      bullet("Message feedback tracking (helpful/unhelpful)"),
      bullet("Follow-up action suggestions extracted from responses"),
      bullet("Context-aware quick replies based on user role"),
      bullet("Guest and authenticated user support"),
      spacer(),

      heading2("7.6 Assignments & Grading"),
      bullet("Tutor-created assignments with rubric criteria and max points"),
      bullet("File uploads (PDF, DOC, DOCX, JPG, PNG, TXT, ZIP) up to 25MB"),
      bullet("Auto-save for draft submissions"),
      bullet("Rubric-based scoring with per-criterion grading"),
      bullet("Late submission support with configurable grace period and penalty"),
      bullet("Resubmission support with configurable limits"),
      bullet("Encrypted file storage in Cloudflare R2"),
      spacer(),

      heading2("7.7 Progress Tracking"),
      bullet("Learning goals with skill tags and target dates"),
      bullet("Goal templates (Master Core Concepts, Exam Prep, Problem Solving, Project Build, etc.)"),
      bullet("Progress entries linked to specific sessions"),
      bullet("Session quality ratings (1-5)"),
      bullet("Chart.js visualization of progress over time"),
      bullet("PDF progress report generation"),
      bullet("Auto-prompts for progress entry after sessions"),
      spacer(),

      heading2("7.8 Guardian System"),
      bullet("Token-based guardian invitation from student registration"),
      bullet("Activity monitoring dashboard with child statistics"),
      bullet("Booking approval/rejection for minor students"),
      bullet("Emergency booking cancellation"),
      bullet("Guardian-tutor messaging (separate from student chat)"),
      bullet("Weekly and monthly spending limits"),
      bullet("Per-child notification configuration"),
      bullet("Guardian access to child session recordings"),
    ],
  };
}

// ── Section 8: Security Architecture ─────────────────────────────────
function section8() {
  return {
    children: [
      heading1("8. Security Architecture"),

      heading2("8.1 Data Protection"),
      bulletBold("Encryption at Rest: ", "Fernet encryption for guardian phone numbers, booking meeting addresses, and uploaded document contents"),
      bulletBold("Password Hashing: ", "Werkzeug's generate_password_hash with default PBKDF2 algorithm"),
      bulletBold("File Integrity: ", "SHA-256 verification hashes for all uploaded documents"),
      bulletBold("Per-File Encryption: ", "Each uploaded document has its own Fernet key, encrypted with the master key"),
      spacer(),

      heading2("8.2 Input Validation & Sanitization"),
      bulletBold("HTML Sanitization: ", "bleach library strips dangerous tags from all user input"),
      bulletBold("Rich Text Sanitization: ", "Whitelist of safe tags (p, br, b, i, strong, em, ul, ol, li) for notes"),
      bulletBold("Length Validation: ", "All text inputs validated for maximum length"),
      bulletBold("File Validation: ", "Magic bytes checking (python-magic) in addition to extension validation"),
      bulletBold("Email Validation: ", "Format validation and normalization"),
      bulletBold("Date Validation: ", "Age range checking for date of birth fields"),
      spacer(),

      heading2("8.3 Application Security"),
      bulletBold("CSRF: ", "Flask-WTF CSRF tokens on all form submissions"),
      bulletBold("Rate Limiting: ", "Flask-Limiter with per-endpoint configuration"),
      bulletBold("Account Lockout: ", "5 failed attempts triggers 15-minute lockout"),
      bulletBold("Session Management: ", "Redis-backed server-side sessions with 30-day lifetime"),
      bulletBold("Security Headers: ", "CSP, HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection"),
      bulletBold("Content Moderation: ", "User-flagged content reports with admin review queue"),
      bulletBold("Audit Logging: ", "All admin actions logged with IP address and details"),
      spacer(),

      heading2("8.4 Consent & Privacy"),
      bullet("Recording requires explicit consent from both student and tutor"),
      bullet("Recording expires after 30 days with automatic deletion"),
      bullet("Session notes support private mode (author-only visibility)"),
      bullet("Guardian access is role-restricted to linked children only"),
      bullet("Meeting addresses are Fernet-encrypted in the database"),
    ],
  };
}

// ── Section 9: Infrastructure & Deployment ───────────────────────────
function section9() {
  return {
    children: [
      heading1("9. Infrastructure & Deployment"),

      heading2("9.1 Deployment Architecture"),
      body("TeachWise uses Docker Compose for multi-container orchestration in production:"),
      spacer(),

      makeTable(["Container", "Image/Service", "Purpose"], [
        ["web", "Flask + Gunicorn (gevent)", "Main application server"],
        ["worker", "Celery", "Async task processing (email, background jobs)"],
        ["db", "PostgreSQL 14/17 + PostGIS", "Primary database"],
        ["redis", "Redis / Upstash", "Caching, sessions, rate limiting, message queue"],
        ["nginx", "Nginx", "Reverse proxy, SSL termination, static files"],
      ]),
      spacer(),

      heading2("9.2 Configuration Management"),
      body("Configuration is managed through environment variables loaded into the Config class:"),
      spacer(),
      makeTable(["Category", "Key Variables"], [
        ["Database", "DATABASE_URL, SQLALCHEMY_POOL_SIZE (15), MAX_OVERFLOW (30)"],
        ["Redis", "REDIS_URL, SESSION_TYPE (redis), USER_CACHE_TTL (300s)"],
        ["Email", "RESEND_API_KEY, RESEND_FROM_NAME, RESEND_FROM_ADDRESS"],
        ["Payments", "STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET"],
        ["AI", "OPENAI_API_KEY"],
        ["Storage", "R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"],
        ["Security", "SECRET_KEY, FERNET_KEY, JWT_SECRET"],
        ["Uploads", "MAX_CONTENT_LENGTH (10MB), DOC_MAX_FILE_SIZE (5MB)"],
      ]),
      spacer(),

      heading2("9.3 Database Connection Pool"),
      body("PostgreSQL connection pooling is configured for production workloads:"),
      bullet("Pool Size: 15 connections"),
      bullet("Max Overflow: 30 additional connections"),
      bullet("Pool Recycle: 300 seconds (prevents stale connections)"),
      bullet("Pool Pre-Ping: Enabled (validates connections before use)"),
      spacer(),

      heading2("9.4 Caching Strategy"),
      bulletBold("User Cache: ", "Redis-backed with 300-second TTL for authenticated user objects"),
      bulletBold("Search Cache: ", "Redis with MD5-hashed keys and 900-second (15-minute) TTL"),
      bulletBold("Category Cache: ", "In-memory lazy loading (loaded once per process)"),
      bulletBold("Cache Invalidation: ", "Pattern-based bulk deletion using Redis SCAN"),
      bulletBold("Graceful Degradation: ", "All cache operations fail silently; app functions without Redis"),
      spacer(),

      heading2("9.5 Background Tasks"),
      heading3("Celery Tasks"),
      bullet("Email delivery via Resend API with 3 retries and exponential backoff"),
      bullet("Rate limited to 100 tasks/minute"),
      bullet("Dedicated 'email' queue for task routing"),
      bullet("Soft timeout: 120s, hard timeout: 180s"),
      spacer(),

      heading3("APScheduler Tasks"),
      bullet("24-hour session reminders"),
      bullet("1-hour session reminders"),
      bullet("Expired recording cleanup"),
      bullet("Search cache invalidation"),
      bullet("Stale session cleanup"),
    ],
  };
}

// ── Section 10: Frontend Architecture ────────────────────────────────
function section10() {
  return {
    children: [
      heading1("10. Frontend Architecture"),

      heading2("10.1 Template Hierarchy"),
      body("All pages extend base.html which provides the common layout:"),
      spacer(),
      codeBlock("base.html"),
      codeBlock("  |-- Navbar (role-specific items, dark mode, notifications)"),
      codeBlock("  |-- Sidebar (auto-included for authenticated users)"),
      codeBlock("  |     |-- student_sidebar.html"),
      codeBlock("  |     |-- tutor_sidebar.html"),
      codeBlock("  |     |-- guardian_sidebar.html"),
      codeBlock("  |     |-- admin_sidebar.html"),
      codeBlock("  |-- Content Area ({% block content %})"),
      codeBlock("  |-- Footer"),
      codeBlock("  |-- Scripts (toast.js, main.js, chatbot.js, notifications.js)"),
      spacer(),

      heading2("10.2 Template Distribution by Role"),
      makeTable(["Role", "Templates", "Key Pages"], [
        ["Student", "12", "Dashboard, bookings, assignments, progress, favorites, locations, wallet"],
        ["Tutor", "16", "Dashboard, profile, availability, earnings, students, documents, setup"],
        ["Admin", "12", "Dashboard, users, bookings, verification, analytics, moderation, settings, audit log"],
        ["Guardian", "9", "Dashboard, child activity, messages, spending limits, notifications"],
        ["Shared", "32", "Auth pages, session room, chat, search, category, payments, recordings, error pages"],
      ]),
      spacer(),

      heading2("10.3 JavaScript Architecture"),
      makeTable(["Module", "Size", "Responsibility"], [
        ["main.js", "Global", "CSRF injection, form validation, password strength, mobile menu"],
        ["notifications.js", "Global", "Real-time notification dropdown with localStorage tracking"],
        ["toast.js", "Global", "Auto-dismissing toast notifications (success/error/warning/info)"],
        ["location-picker.js", "Reusable", "Leaflet map component with geocoding search and radius"],
        ["chatbot.js", "Global", "AI chatbot widget with conversation management"],
        ["socket.io.min.js", "Library", "WebSocket client for real-time features"],
      ]),
      spacer(),

      heading2("10.4 CSS Architecture"),
      bullet("Tailwind CSS (prebuilt, not JIT) for utility-first styling"),
      bullet("Custom CSS for animations (shimmer, pulse-glow, wave, breathe)"),
      bullet("Category card gradients use inline styles to avoid Tailwind purging"),
      bullet("Dark mode via CSS custom properties and .dark class toggling"),
      bullet("Responsive breakpoints: mobile-first with md: (768px) breakpoint"),
      bullet("Custom scrollbar styling for Firefox and Chrome"),
      bullet("WCAG 2.1 AA compliant focus states and skip-to-content links"),
    ],
  };
}

// ── Section 11: Categories & Content ─────────────────────────────────
function section11() {
  return {
    children: [
      heading1("11. Content Architecture"),

      heading2("11.1 Category Hierarchy"),
      body("The platform organizes tutoring subjects into a three-tier hierarchy loaded from categories.json:"),
      spacer(),

      makeTable(["Category", "Subcategories", "Sample Topics"], [
        ["Academics & Tutoring", "9", "Algebra, Physics, SAT Prep, College Admissions"],
        ["Languages", "5", "ESL, Spanish, Mandarin, ASL, 21 languages"],
        ["Music", "7", "Piano, Guitar, Vocal Training, Music Production"],
        ["Dance", "5", "Ballet, Hip-Hop, Salsa, Bollywood, Zumba"],
        ["Sports & Athletics", "6", "Basketball, Swimming, Golf, Track & Field"],
        ["Martial Arts & Self Defense", "4", "Boxing, BJJ, MMA, Krav Maga"],
        ["Fitness & Personal Training", "4", "Weight Training, HIIT, CrossFit, Senior Fitness"],
        ["Yoga & Wellness", "3", "Hatha Yoga, Meditation, Pilates, Tai Chi"],
        ["Cooking & Culinary Arts", "6", "Knife Skills, Sushi, Pastry, Vegan, Mixology"],
        ["Visual Arts & Design", "6", "Oil Painting, Digital Illustration, Photography, UI/UX"],
        ["Crafts & Handmade", "5", "Knitting, Origami, Jewelry Making, Woodworking"],
        ["Technology & CS", "8", "Python, React, Machine Learning, AWS, Unity"],
        ["Business & Professional", "6", "Entrepreneurship, SEO, Financial Modeling, PMP Prep"],
        ["Film, Video & Creative Media", "5", "Filmmaking, YouTube, Animation, Acting"],
        ["Life Skills", "7", "Driving, Home Repair, Gardening, Dog Training"],
        ["Fashion & Beauty", "5", "Makeup, Hair Styling, Nail Art, Personal Styling"],
        ["Health & Medical", "4", "MCAT Prep, Nutrition, CPR Certification"],
        ["Trades & Vocational", "4", "Carpentry, Welding, Auto Mechanics, HVAC"],
        ["Games & Strategy", "3", "Chess, League of Legends Coaching, Magic Tricks"],
        ["Religion & Philosophy", "3", "Bible Study, Stoicism, Tarot Reading"],
        ["Aviation & Nautical", "2", "Private Pilot Ground School, Sailing"],
        ["Event Planning", "2", "Wedding Planning, Bartending, Sommelier"],
        ["Environmental", "2", "Permaculture, Bird Watching, Foraging"],
        ["Legal Education", "2", "LSAT Prep, Contract Basics, Citizenship Test"],
      ]),
      spacer(),

      heading2("11.2 Category Styling System"),
      body("Each category has a unique visual identity defined in utils/categories.py:"),
      bullet("24-color Tailwind palette rotation for card backgrounds"),
      bullet("Font Awesome icon presets mapped to each category"),
      bullet("Inline CSS gradients to prevent Tailwind purge"),
      bullet("8 animation types distributed across categories (shimmer, pulse-glow, wave, breathe)"),
      bullet("Fallback gradient styles for unmapped categories"),
    ],
  };
}

// ── Section 12: Directory Structure ──────────────────────────────────
function section12() {
  return {
    children: [
      heading1("12. Project Directory Structure"),
      spacer(),
      codeBlock("TeachWise/"),
      codeBlock("|-- app.py                    # Main Flask application (385 lines)"),
      codeBlock("|-- config.py                 # Configuration management (129 lines)"),
      codeBlock("|-- database.py               # SQLAlchemy instance"),
      codeBlock("|-- extensions.py             # Flask-Limiter, Flask-SocketIO"),
      codeBlock("|-- celery_app.py             # Celery worker configuration"),
      codeBlock("|-- requirements.txt          # Python dependencies (52 packages)"),
      codeBlock("|-- categories.json           # Category/subcategory/topic data (745 lines)"),
      codeBlock("|-- Dockerfile                # Container image definition"),
      codeBlock("|-- docker-compose.yml        # Multi-container orchestration"),
      codeBlock("|-- nginx.conf                # Reverse proxy configuration"),
      codeBlock("|-- gunicorn.conf.py          # Production WSGI settings"),
      codeBlock("|"),
      codeBlock("|-- routes/                   # 20 Flask blueprint modules (~9,500 lines)"),
      codeBlock("|   |-- student_routes.py     # Student auth, dashboard, bookings"),
      codeBlock("|   |-- tutor_routes.py       # Tutor auth, profile, availability"),
      codeBlock("|   |-- admin_routes.py       # Admin dashboard, analytics, moderation"),
      codeBlock("|   |-- guardian_routes.py     # Guardian auth, child monitoring"),
      codeBlock("|   |-- session_routes.py      # Video session management"),
      codeBlock("|   |-- chat_routes.py        # Real-time chat"),
      codeBlock("|   |-- payment_routes.py     # Stripe payments"),
      codeBlock("|   |-- wallet_routes.py      # Wallet management"),
      codeBlock("|   |-- search_routes.py      # Tutor search"),
      codeBlock("|   |-- assignment_routes.py  # Assignments"),
      codeBlock("|   |-- progress_routes.py    # Learning goals"),
      codeBlock("|   |-- note_routes.py        # Session notes"),
      codeBlock("|   |-- recording_routes.py   # Session recordings"),
      codeBlock("|   |-- whiteboard_routes.py  # Whiteboard collaboration"),
      codeBlock("|   |-- reschedule_routes.py  # Booking rescheduling"),
      codeBlock("|   |-- notification_*.py     # Notifications"),
      codeBlock("|   |-- document_routes.py    # Document verification"),
      codeBlock("|   |-- geocoding_routes.py   # Location services"),
      codeBlock("|   |-- internal_api.py       # Service-to-service API"),
      codeBlock("|"),
      codeBlock("|-- models/                   # 35 SQLAlchemy models (~1,200 lines)"),
      codeBlock("|   |-- student.py, tutor.py, guardian.py, admin.py"),
      codeBlock("|   |-- booking.py, slots.py, reschedule.py"),
      codeBlock("|   |-- message.py, guardian_message.py, chatbot.py"),
      codeBlock("|   |-- assignment.py, learning_goal.py"),
      codeBlock("|   |-- review.py, session_note.py, recording.py, whiteboard.py"),
      codeBlock("|   |-- payment.py, wallet.py, wallet_transaction.py, refund_request.py"),
      codeBlock("|   |-- in_app_notification.py, email_notification.py"),
      codeBlock("|   |-- audit_log.py, content_report.py, platform_setting.py"),
      codeBlock("|   |-- favorite.py, student_saved_location.py, tutor_document.py"),
      codeBlock("|"),
      codeBlock("|-- services/                 # Business logic (~6,200 lines)"),
      codeBlock("|   |-- search_service.py     # PostGIS search + caching"),
      codeBlock("|   |-- payment_service.py    # Stripe integration"),
      codeBlock("|   |-- booking_service.py    # Booking logic"),
      codeBlock("|   |-- email_service.py      # Resend.com integration"),
      codeBlock("|   |-- notification_service.py  # In-app notifications"),
      codeBlock("|   |-- recommendation_service.py # Tutor recommendations"),
      codeBlock("|   |-- encryption_service.py # Fernet encryption"),
      codeBlock("|   |-- geocoding_service.py  # Nominatim geocoding"),
      codeBlock("|   |-- storage_service.py    # Cloudflare R2 uploads"),
      codeBlock("|   |-- cache_service.py      # Redis caching"),
      codeBlock("|   |-- scheduler_service.py  # APScheduler jobs"),
      codeBlock("|   |-- tasks/email_tasks.py  # Celery async email"),
      codeBlock("|"),
      codeBlock("|-- templates/                # 81 Jinja2 templates"),
      codeBlock("|   |-- base.html             # Master layout"),
      codeBlock("|   |-- student_*.html (12)   # Student views"),
      codeBlock("|   |-- tutor_*.html (16)     # Tutor views"),
      codeBlock("|   |-- admin_*.html (12)     # Admin views"),
      codeBlock("|   |-- guardian_*.html (9)   # Guardian views"),
      codeBlock("|   |-- session_*.html (4)    # Session views"),
      codeBlock("|   |-- (28 shared templates) # Auth, search, payments, etc."),
      codeBlock("|"),
      codeBlock("|-- static/                   # Frontend assets"),
      codeBlock("|   |-- css/style.css         # Custom styles + animations"),
      codeBlock("|   |-- css/tailwind.min.css  # Tailwind CSS framework"),
      codeBlock("|   |-- js/main.js            # Global utilities"),
      codeBlock("|   |-- js/notifications.js   # Notification dropdown"),
      codeBlock("|   |-- js/toast.js           # Toast notifications"),
      codeBlock("|   |-- js/location-picker.js # Map component"),
      codeBlock("|"),
      codeBlock("|-- utils/                    # Utility modules"),
      codeBlock("|   |-- auth.py               # RBAC decorators + lockout"),
      codeBlock("|   |-- validators.py         # Input validation"),
      codeBlock("|   |-- sanitizer.py          # HTML sanitization"),
      codeBlock("|   |-- categories.py         # Category loading + styling"),
      codeBlock("|   |-- timezone_utils.py     # Timezone conversion"),
      codeBlock("|   |-- distance.py           # Haversine calculation"),
      codeBlock("|   |-- logging_config.py     # JSON structured logging"),
      codeBlock("|"),
      codeBlock("|-- chatbot/                  # AI chatbot module"),
      codeBlock("|   |-- backend/routes.py     # REST API endpoints"),
      codeBlock("|   |-- backend/service.py    # OpenAI GPT-4o integration"),
      codeBlock("|   |-- backend/tools.py      # Function calling definitions"),
      codeBlock("|   |-- frontend/chatbot.js   # Chat widget UI"),
      codeBlock("|   |-- frontend/chatbot.css  # Widget styles"),
      codeBlock("|"),
      codeBlock("|-- shared/                   # Cross-service infrastructure"),
      codeBlock("|   |-- event_bus.py          # Redis pub/sub events"),
      codeBlock("|   |-- jwt_auth.py           # JWT token management"),
      codeBlock("|   |-- service_client.py     # HTTP client with retries"),
      codeBlock("|"),
      codeBlock("|-- migrations/               # 28 Alembic migration files"),
      codeBlock("|-- tests/                    # Test suite (pytest)"),
      codeBlock("|-- docgen/                   # Documentation generators (Node.js)"),
    ],
  };
}

// ── Section 13: Testing ──────────────────────────────────────────────
function section13() {
  return {
    children: [
      heading1("13. Testing Strategy"),

      heading2("13.1 Test Configuration"),
      body("Tests use a separate TestConfig with in-memory SQLite and disabled security features:"),
      spacer(),
      bullet("Database: In-memory SQLite (no PostgreSQL required)"),
      bullet("CSRF protection: Disabled for test simplicity"),
      bullet("Rate limiting: Disabled to prevent test interference"),
      bullet("Test Stripe keys: Dedicated test API keys"),
      spacer(),

      heading2("13.2 Test Suite"),
      makeTable(["Test File", "Coverage Area"], [
        ["tests/conftest.py", "Fixtures: app, client, database, sample users"],
        ["tests/test_chatbot.py", "Chatbot conversation, message, and tool call flows"],
        ["tests/test_guardian.py", "Guardian registration, login, child monitoring"],
        ["tests/test_integration.py", "Cross-module integration scenarios"],
        ["tests/test_payment.py", "Stripe checkout, webhooks, wallet, refunds"],
        ["tests/test_performance.py", "Response time and database query benchmarks"],
        ["tests/test_security.py", "CSRF, XSS, SQL injection, rate limiting, auth bypass"],
        ["tests/test_services.py", "Service layer unit tests (search, email, booking)"],
      ]),
      spacer(),

      heading2("13.3 Testing Tools"),
      bullet("pytest 8.1.1 - Test runner and assertion framework"),
      bullet("pytest-cov 5.0.0 - Code coverage measurement"),
      bullet("Flask test client - HTTP request simulation"),
      bullet("SQLite in-memory - Fast, isolated database per test"),
    ],
  };
}

// ── Section 14: Appendix ─────────────────────────────────────────────
function section14() {
  return {
    children: [
      heading1("14. Appendix"),

      heading2("A. Environment Variables"),
      makeTable(["Variable", "Required", "Description"], [
        ["SECRET_KEY", "Yes", "Flask session signing key"],
        ["DATABASE_URL", "Yes", "PostgreSQL connection string"],
        ["REDIS_URL", "No", "Redis connection (falls back to filesystem sessions)"],
        ["FERNET_KEY", "Yes", "Master encryption key for sensitive data"],
        ["STRIPE_SECRET_KEY", "Yes", "Stripe API secret key"],
        ["STRIPE_PUBLISHABLE_KEY", "Yes", "Stripe publishable key (frontend)"],
        ["STRIPE_WEBHOOK_SECRET", "Yes", "Stripe webhook signature verification"],
        ["RESEND_API_KEY", "Yes", "Resend.com email API key"],
        ["OPENAI_API_KEY", "No", "OpenAI API key (chatbot)"],
        ["R2_ENDPOINT", "No", "Cloudflare R2 endpoint URL"],
        ["R2_ACCESS_KEY_ID", "No", "R2 access credentials"],
        ["R2_SECRET_ACCESS_KEY", "No", "R2 secret credentials"],
        ["R2_BUCKET_NAME", "No", "R2 bucket name"],
        ["JWT_SECRET", "No", "JWT signing secret (microservice auth)"],
        ["RUN_SCHEDULER", "No", "Enable/disable APScheduler (default: true)"],
      ]),
      spacer(),

      heading2("B. Status State Machines"),
      heading3("Booking Status"),
      codeBlock("Booked --> Live --> Completed"),
      codeBlock("  |                  |"),
      codeBlock("  +--> Cancelled     +--> Reviewed"),
      spacer(),

      heading3("Tutor Verification Status"),
      codeBlock("pending_documents --> documents_submitted --> under_review"),
      codeBlock("  --> verified | rejected | revision_required --> verification_expired"),
      spacer(),

      heading3("Payment Status"),
      codeBlock("pending --> completed --> refunded | partial_refund"),
      codeBlock("  +--> failed"),
      spacer(),

      heading3("Assignment Status"),
      codeBlock("assigned --> submitted --> reviewed | returned"),
      codeBlock("  +--> overdue"),
      spacer(),

      heading2("C. Quick Start Commands"),
      heading3("Start Development Server"),
      codeBlock("RUN_SCHEDULER=false python -c \""),
      codeBlock("from app import app, socketio"),
      codeBlock("from database import db"),
      codeBlock("with app.app_context():"),
      codeBlock("    db.create_all()"),
      codeBlock("socketio.run(app, debug=False, port=5001,"),
      codeBlock("    allow_unsafe_werkzeug=True, use_reloader=False, log_output=True)"),
      codeBlock("\""),
      spacer(),

      heading3("Run Tests"),
      codeBlock("pytest tests/ -v --cov=. --cov-report=term-missing"),
      spacer(),

      heading3("Generate Documentation"),
      codeBlock("cd docgen && node build.js"),
      spacer(),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        border: { top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" } },
        children: [
          new TextRun({ text: "\nDocument generated: March 13, 2026", size: 18, color: GRAY, font: "Calibri", italics: true }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({ text: "TeachWise Architecture Document v1.0", size: 18, color: GRAY, font: "Calibri", italics: true }),
        ],
      }),
    ],
  };
}

// ── Assemble & Generate ──────────────────────────────────────────────
const allSections = [
  coverPage(),
  section1(),
  section2(),
  section3(),
  section4(),
  section5(),
  section6(),
  section7(),
  section8(),
  section9(),
  section10(),
  section11(),
  section12(),
  section13(),
  section14(),
];

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: "left",
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
          {
            level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: "left",
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: allSections,
});

const outputPath = path.resolve(__dirname, "..", "TeachWise_Architecture_Document.docx");

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
  console.log(`Generated: ${outputPath}`);
  console.log(`Size: ${sizeMB} MB`);
  console.log(`Sections: ${allSections.length}`);
}).catch((err) => {
  console.error("Failed to generate document:", err);
  process.exit(1);
});
