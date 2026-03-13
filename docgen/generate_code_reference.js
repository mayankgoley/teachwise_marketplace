const docx = require("docx");
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType,
  Header, Footer, PageBreak, TableOfContents, LevelFormat,
  PageNumber, NumberFormat, Tab, TabStopPosition, TabStopType,
  ImageRun, ExternalHyperlink, convertInchesToTwip
} = docx;

// ═══════════════════════════════════════════════════════
// COLOR SCHEME
// ═══════════════════════════════════════════════════════
const C = {
  primary: "1B4F72",
  accent: "2E86C1",
  lightBlueBg: "D6EAF8",
  warningBg: "FEF9E7", warningBorder: "F39C12",
  dangerBg: "FDEDEC", dangerBorder: "C0392B",
  successBg: "E9F7EF", successBorder: "1E8449",
  codeBg: "F8F9FA", codeBorder: "566573",
  tableHeaderBg: "1B4F72",
  tableAltRow: "F2F3F4",
  tableBorder: "AEB6BF",
  white: "FFFFFF",
  codeRed: "C0392B",
  black: "000000",
  gray: "888888",
  navy: "1B4F72",
};

// ═══════════════════════════════════════════════════════
// REUSABLE PARAGRAPH / TEXT HELPERS
// ═══════════════════════════════════════════════════════
const FONT = "Arial";
const CODE_FONT = "Courier New";

function txt(text, opts = {}) {
  return new TextRun({
    text,
    font: opts.font || FONT,
    size: opts.size || 22,
    bold: opts.bold || false,
    italics: opts.italics || false,
    color: opts.color || C.black,
    underline: opts.underline ? {} : undefined,
  });
}

function codeTxt(text, opts = {}) {
  return new TextRun({
    text,
    font: CODE_FONT,
    size: opts.size || 20,
    bold: opts.bold || false,
    color: opts.color || C.codeRed,
  });
}

function para(children, opts = {}) {
  if (typeof children === "string") children = [txt(children)];
  return new Paragraph({
    children,
    spacing: { after: opts.after || 120, before: opts.before || 0 },
    alignment: opts.alignment || AlignmentType.LEFT,
    heading: opts.heading,
    indent: opts.indent,
    numbering: opts.numbering,
    pageBreakBefore: opts.pageBreakBefore || false,
  });
}

function h1(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 36, bold: true, color: C.primary })],
    spacing: { before: 240, after: 200 },
    pageBreakBefore: true,
  });
}

function h2(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 28, bold: true, color: C.primary })],
    spacing: { before: 200, after: 160 },
  });
}

function h3(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 24, bold: true, color: C.accent })],
    spacing: { before: 160, after: 120 },
  });
}

function h4(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 22, bold: true, color: C.black })],
    spacing: { before: 120, after: 100 },
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    children: typeof text === "string" ? [txt(text)] : text,
    numbering: { reference: "bullets", level },
    spacing: { after: 60 },
  });
}

function numItem(text, level = 0) {
  return new Paragraph({
    children: typeof text === "string" ? [txt(text)] : text,
    numbering: { reference: "numbers", level },
    spacing: { after: 60 },
  });
}

function codeBlock(lines) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9360, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: C.codeBg },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: C.codeBorder },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: C.codeBorder },
              left: { style: BorderStyle.SINGLE, size: 6, color: C.codeBorder },
              right: { style: BorderStyle.SINGLE, size: 1, color: C.codeBorder },
            },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            children: lines.map(l => new Paragraph({
              children: [new TextRun({ text: l, font: CODE_FONT, size: 18, color: "2C3E50" })],
              spacing: { after: 20 },
            })),
          }),
        ],
      }),
    ],
  });
}

// ═══════════════════════════════════════════════════════
// TABLE HELPERS
// ═══════════════════════════════════════════════════════
const CELL_MARGINS = { top: 60, bottom: 60, left: 100, right: 100 };
const TB = { style: BorderStyle.SINGLE, size: 1, color: C.tableBorder };
const BORDERS = { top: TB, bottom: TB, left: TB, right: TB };

function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: C.tableHeaderBg },
    borders: BORDERS,
    margins: CELL_MARGINS,
    children: [new Paragraph({
      children: [new TextRun({ text, font: FONT, size: 20, bold: true, color: C.white })],
      spacing: { after: 0 },
    })],
  });
}

function dataCell(text, width, alt = false, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: alt ? C.tableAltRow : C.white },
    borders: BORDERS,
    margins: CELL_MARGINS,
    children: [new Paragraph({
      children: typeof text === "string"
        ? [new TextRun({ text, font: opts.font || FONT, size: opts.size || 20, color: opts.color || C.black, bold: opts.bold || false })]
        : text,
      spacing: { after: 0 },
    })],
  });
}

function makeTable(headers, rows, colWidths) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    children: headers.map((h, i) => headerCell(h, colWidths[i])),
  });
  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cell, ci) => dataCell(cell, colWidths[ci], ri % 2 === 1)),
    })
  );
  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });
}

// Info/Warning/Danger boxes
function infoBox(text, type = "info") {
  const colors = {
    info: { bg: C.lightBlueBg, border: C.accent },
    warning: { bg: C.warningBg, border: C.warningBorder },
    danger: { bg: C.dangerBg, border: C.dangerBorder },
    success: { bg: C.successBg, border: C.successBorder },
  };
  const c = colors[type] || colors.info;
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9360, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: c.bg },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: c.border },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: c.border },
              left: { style: BorderStyle.SINGLE, size: 8, color: c.border },
              right: { style: BorderStyle.SINGLE, size: 1, color: c.border },
            },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            children: [para(text)],
          }),
        ],
      }),
    ],
  });
}

function spacer(height = 200) {
  return new Paragraph({ spacing: { after: height } });
}

// ═══════════════════════════════════════════════════════
// DOCUMENT CONSTRUCTION START
// ═══════════════════════════════════════════════════════
const sections = [];

// We'll build all sections below, then construct the Document at the end.
// Each "section" in our array will become a docx section with header/footer.

function buildSection(footerLeft, children) {
  return {
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [
              txt("TeachWise Code Reference", { size: 18, color: C.navy, bold: true }),
              new TextRun({ text: "\t", font: FONT }),
              new TextRun({ text: "\t", font: FONT }),
              txt("Internal — Developer Use Only", { size: 16, color: C.gray, italics: true }),
            ],
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.navy } },
            tabStops: [
              { type: TabStopType.CENTER, position: 4680 },
              { type: TabStopType.RIGHT, position: 9360 },
            ],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            children: [
              txt(footerLeft, { size: 16, color: C.gray }),
              new TextRun({ text: "\t", font: FONT }),
              new TextRun({ text: "\t", font: FONT }),
              txt("Page ", { size: 16, color: C.gray }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: C.gray }),
            ],
            border: { top: { style: BorderStyle.SINGLE, size: 1, color: C.gray } },
            tabStops: [
              { type: TabStopType.CENTER, position: 4680 },
              { type: TabStopType.RIGHT, position: 9360 },
            ],
          }),
        ],
      }),
    },
    children,
  };
}

// ═══════════════════════════════════════════════════════
// COVER PAGE
// ═══════════════════════════════════════════════════════
const coverChildren = [
  spacer(1200),
  new Paragraph({
    children: [new TextRun({ text: "TeachWise Platform", font: FONT, size: 56, bold: true, color: C.primary })],
    alignment: AlignmentType.CENTER,
  }),
  new Paragraph({
    children: [new TextRun({ text: "Code Reference Guide", font: FONT, size: 44, bold: true, color: C.accent })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "Deep-dive documentation for complex modules", font: FONT, size: 26, italics: true, color: C.gray })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }),
  new Paragraph({
    children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, font: FONT, size: 22, color: C.gray })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
  }),
  h3("Files Documented"),
  makeTable(
    ["#", "File", "Path", "Lines (approx)", "Complexity"],
    [
      ["1", "tutor_routes.py", "routes/tutor_routes.py", "~1970", "Critical"],
      ["2", "payment_routes.py", "routes/payment_routes.py", "~500", "High"],
      ["3", "payment_service.py", "services/payment_service.py", "~136", "High"],
      ["4", "booking_service.py", "services/booking_service.py", "~190", "Critical"],
      ["5", "email_service.py", "services/email_service.py", "~306", "High"],
      ["6", "recommendation_service.py", "services/recommendation_service.py", "~110", "Medium"],
      ["7", "scheduler_service.py", "services/scheduler_service.py", "~243", "High"],
      ["8", "event_bus.py", "shared/event_bus.py", "~150", "High"],
      ["9", "jwt_auth.py", "shared/jwt_auth.py", "~205", "High"],
      ["10", "service_client.py", "shared/service_client.py", "~180", "High"],
      ["11", "auth.py", "utils/auth.py", "~55", "Medium"],
      ["12", "validators.py", "utils/validators.py", "~123", "Medium"],
      ["13", "sanitizer.py", "utils/sanitizer.py", "~27", "Low"],
      ["14", "celery_app.py", "celery_app.py", "~29", "Medium"],
      ["15", "email_tasks.py", "services/tasks/email_tasks.py", "~93", "High"],
      ["16", "storage_service.py", "services/storage_service.py", "~166", "High"],
      ["17", "encryption_service.py", "services/encryption_service.py", "~39", "High"],
      ["18", "config.py", "config.py", "~130", "Medium"],
      ["19", "Models (29 files)", "models/*.py", "~900+", "Medium–High"],
    ],
    [400, 2200, 2600, 1400, 1200]
  ),
];

sections.push(buildSection("Cover", coverChildren));

// ═══════════════════════════════════════════════════════
// SECTION 0: HOW TO USE THIS DOCUMENT
// ═══════════════════════════════════════════════════════
sections.push(buildSection("How to Use", [
  h1("Section 0: How to Use This Document"),
  h3("Scope"),
  para("This document covers only the high-complexity files in the TeachWise codebase. For a complete file inventory, deployment procedures, and operational runbooks, refer to the TeachWise Maintenance & Operations Guide."),
  h3("Navigation"),
  bullet("Each documented file has its own top-level section header (e.g., \"1. tutor_routes.py\")."),
  bullet("Within each file section, every function is a subsection you can jump to."),
  bullet("Use your PDF viewer's bookmark/outline panel to navigate quickly."),
  h3("Conventions"),
  bullet("Parameter Tables: Every function's parameters are listed in a table with type, required/optional, default, and description."),
  bullet("Side Effects: A bulleted list of everything a function does beyond returning a value (DB writes, emails, cache invalidation, etc)."),
  bullet("Failure Modes: A table covering every way a function can fail and what happens."),
  bullet("Code signatures are shown in Courier New, red color."),
  h3("Keeping This Document Updated"),
  bullet("When a function signature changes, update its parameter table and side-effect list."),
  bullet("When a new route is added, add a full function block following the template."),
  bullet("When an external service integration changes (e.g., Stripe API version), update the External API Call Inventory in Section A.8."),
  bullet("Re-run the generation script after major code changes to produce a fresh copy."),
  infoBox("This document was auto-generated from source code analysis. Always verify against the actual code for the most current behavior.", "info"),
]));

// ═══════════════════════════════════════════════════════
// FILE SECTIONS — We'll build each one
// ═══════════════════════════════════════════════════════

// Helper to build a function documentation block
function funcBlock(name, sig, summary, params, returns, sideEffects, failures, calledBy, calls, notes, example) {
  const elems = [];
  elems.push(h4(`${name}()`));
  elems.push(para([txt(summary, { italics: true })], { after: 80 }));
  elems.push(para([txt("Signature", { bold: true, size: 22 })]));
  elems.push(codeBlock(sig.split("\n")));
  elems.push(spacer(80));

  if (params && params.length > 0) {
    elems.push(para([txt("Parameters", { bold: true })]));
    elems.push(makeTable(
      ["Parameter", "Type", "Required", "Default", "Description"],
      params,
      [1600, 1200, 800, 900, 4860]
    ));
    elems.push(spacer(80));
  }

  if (returns) {
    elems.push(para([txt("Returns: ", { bold: true }), txt(returns)]));
  }

  if (sideEffects && sideEffects.length > 0) {
    elems.push(para([txt("Side Effects", { bold: true })]));
    sideEffects.forEach(s => elems.push(bullet(s)));
  }

  if (failures && failures.length > 0) {
    elems.push(para([txt("Failure Modes", { bold: true })]));
    elems.push(makeTable(
      ["Condition", "Exception / Status", "What Caller Should Do"],
      failures,
      [3200, 2800, 3360]
    ));
    elems.push(spacer(80));
  }

  if (calledBy) {
    elems.push(para([txt("Called By: ", { bold: true }), txt(calledBy)]));
  }
  if (calls) {
    elems.push(para([txt("Calls: ", { bold: true }), txt(calls)]));
  }

  if (example) {
    elems.push(para([txt("Example", { bold: true })]));
    elems.push(codeBlock(example));
  }

  if (notes) {
    elems.push(infoBox(notes, "warning"));
  }

  elems.push(spacer(120));
  return elems;
}

// ═══════════════════════════════════════════════════════
// SECTION 1: routes/tutor_routes.py
// ═══════════════════════════════════════════════════════
const tutorRoutesChildren = [
  h1("1. tutor_routes.py (routes/tutor_routes.py)"),

  h2("Overview"),
  para("This is the largest route file in the TeachWise codebase (~1,970 lines). It handles all tutor-facing functionality: registration, login, profile management, slot/availability CRUD, booking flow, earnings reporting, onboarding wizard, review responses, and the public tutor profile page. It also contains the student-facing book_session route. A bug here would break tutor operations, student booking, Stripe checkout initiation, review interactions, and earnings exports."),

  h2("Dependencies"),
  makeTable(
    ["Import", "Type", "Used For"],
    [
      ["flask (Blueprint, request, redirect, etc.)", "Third-party", "HTTP request handling, template rendering"],
      ["flask_login", "Third-party", "Session auth (login_user, logout_user, current_user, login_required)"],
      ["database.db", "Internal", "SQLAlchemy session"],
      ["extensions.limiter", "Internal", "Rate limiting via Flask-Limiter"],
      ["models.tutor.Tutor", "Internal", "Tutor ORM model"],
      ["models.slots.TutorSlot", "Internal", "Slot ORM model"],
      ["models.review.Review", "Internal", "Review ORM model"],
      ["models.booking.Booking", "Internal", "Booking ORM model"],
      ["models.student.Student", "Internal", "Student ORM model"],
      ["werkzeug.security", "Third-party", "Password hashing (generate_password_hash, check_password_hash)"],
      ["werkzeug.utils.secure_filename", "Third-party", "Filename sanitization"],
      ["utils.sanitizer", "Internal", "HTML sanitization (sanitize_text, sanitize_input_length)"],
      ["utils.auth", "Internal", "role_required, account lockout functions"],
      ["utils.validators", "Internal", "Password complexity validation"],
      ["services.encryption_service", "Internal", "Token generation/verification for password resets"],
      ["services.booking_service", "Internal", "cancel_booking, create_booking, send_booking_emails"],
      ["datetime, os, uuid", "stdlib", "Date math, file ops, UUID generation"],
    ],
    [3600, 1400, 4360]
  ),

  h2("Constants & Configuration"),
  makeTable(
    ["Name", "Value", "What It Controls"],
    [
      ["ALLOWED_EXTENSIONS", "{'png', 'jpg', 'jpeg'}", "File types accepted for profile photo upload"],
      ["PHOTO_MAGIC", "bytes→ext mapping", "Magic byte validation for uploaded images (JPEG: FF D8 FF, PNG: 89 50 4E 47)"],
    ],
    [2400, 2600, 4360]
  ),

  h2("Slot Management Routes"),

  ...funcBlock(
    "calc_profile_completion",
    "def calc_profile_completion(tutor):",
    "Calculates tutor profile completeness as a percentage (0–100) and returns a list of missing items with URLs.",
    [
      ["tutor", "Tutor", "Yes", "—", "Tutor model instance to evaluate"],
    ],
    "dict with keys: 'percentage' (int 0-100), 'missing' (list of {label, url} dicts). Checks: profile_photo (15%), bio≥50chars (15%), qualification (10%), institution (5%), hourly_rate>0 (10%), teaching_mode (10%), subjects_additional (5%), has≥1 slot (15%), stripe_connected (10%), address (5%).",
    ["DB read: queries TutorSlot to check if at least one slot exists"],
    [["Tutor has no slots/profile", "No exception — returns low %", "Display missing items to tutor"]],
    "tutor_dashboard, edit_profile",
    "TutorSlot.query.filter_by()",
    "The slot existence check runs a DB query every time. Consider caching for dashboards with high traffic."
  ),

  ...funcBlock(
    "edit_profile",
    "@tutor_bp.route('/tutor/edit-profile', methods=['GET', 'POST'])\n@role_required('tutor')\ndef edit_profile():",
    "GET: renders the profile edit form. POST: updates tutor profile fields including bio, qualification, hourly rate, teaching mode, subjects, timezone, and address (with geocoding).",
    [],
    "GET: renders tutor_edit_profile.html. POST: redirects to self with flash message.",
    [
      "DB UPDATE: Tutor record (bio, qualification, institution, hourly_rate, teaching_mode, subjects_additional, timezone, address, lat/lng)",
      "External API: geocoding_service.geocode_and_save() if address changed",
      "Cache invalidation: search_service.invalidate_search_cache()",
    ],
    [
      ["Geocoding fails", "Caught — flash warning", "Address saved but lat/lng not updated"],
      ["Cache invalidation fails", "Caught — logged", "Stale search results until next invalidation"],
      ["Invalid hourly_rate", "ValueError caught — field skipped", "Previous value retained"],
    ],
    "Template form submission",
    "sanitize_input_length, geocode_and_save, invalidate_search_cache, db.session.commit",
    "Subjects are split by comma, limited to 10 entries. Input sanitization via sanitize_input_length caps bio at 500 chars, qualification/institution at 200."
  ),

  ...funcBlock(
    "upload_photo",
    "@tutor_bp.route('/tutor/upload-photo', methods=['POST'])\n@role_required('tutor')\ndef upload_photo():",
    "Handles AJAX profile photo upload. Validates extension, file size (2MB), magic bytes. Uploads to R2/local, deletes old photo, updates tutor record.",
    [],
    "JSON: {success: true, url: string} or {success: false, error: string}",
    [
      "File upload to R2 (or local fallback) via upload_public_file()",
      "File delete of old photo via delete_public_file()",
      "DB UPDATE: Tutor.profile_photo",
      "Cache invalidation: invalidate_search_cache()",
    ],
    [
      ["No file selected", "JSON error", "Show error to user"],
      ["Wrong extension", "JSON error 'Only JPG and PNG allowed'", "Reject upload"],
      ["File > 2MB", "JSON error 'File too large'", "Reject upload"],
      ["Invalid magic bytes", "JSON error 'Invalid file type'", "Reject — prevents extension spoofing"],
      ["R2 upload fails", "JSON error 'Upload failed'", "Retry later"],
    ],
    "Frontend AJAX call",
    "upload_public_file, delete_public_file, invalidate_search_cache",
    "Magic byte validation prevents disguised file uploads (e.g., .exe renamed to .jpg). Old photo deletion extracts R2 key from various URL formats."
  ),

  ...funcBlock(
    "register",
    "@tutor_bp.route('/tutor/register', methods=['GET', 'POST'])\n@limiter.limit('5 per hour', methods=['POST'])\ndef register():",
    "Tutor registration. Validates name, email uniqueness, password complexity, creates Tutor record, geocodes address, sends welcome email.",
    [],
    "GET: renders register_tutor.html. POST: redirect to login on success.",
    [
      "DB INSERT: new Tutor record",
      "External API: geocoding_service.geocode_and_save() for address",
      "Email: email_welcome_tutor() via send_email()",
    ],
    [
      ["Missing required fields", "Flash warning, redirect", "Fix form"],
      ["Weak password", "Flash with specific error message", "Meet 12-char + upper + digit + special requirement"],
      ["Duplicate email", "Flash danger", "Use different email or login"],
      ["DB error", "Rollback, flash error", "Retry"],
    ],
    "Registration form",
    "validate_password_complexity, generate_password_hash, geocode_and_save, send_email, email_welcome_tutor",
    "Rate limited to 5 POST requests per hour. Verification status defaults to 'pending_documents'."
  ),

  ...funcBlock(
    "login",
    "@tutor_bp.route('/tutor/login', methods=['GET', 'POST'])\n@limiter.limit('10 per 15 minutes', methods=['POST'])\ndef login():",
    "Tutor login with account lockout protection. On success, creates Flask-Login session and sets JWT cookie for microservice auth.",
    [],
    "GET: renders tutor_login.html. POST: redirect to dashboard on success.",
    [
      "DB READ: Tutor by email",
      "Account lockout check via is_account_locked()",
      "Failed login increment via increment_failed_login()",
      "Login success: reset_failed_login(), login_user()",
      "JWT cookie set: tw_jwt, httponly, 24h max_age",
    ],
    [
      ["Account locked", "Flash danger, redirect to login", "Wait 15 minutes"],
      ["Wrong credentials", "Flash danger, increment failure count", "Retry with correct credentials"],
      ["JWT creation fails", "Caught — login still succeeds without JWT", "Microservice features may not work"],
    ],
    "Login form",
    "is_account_locked, check_password_hash, increment_failed_login, reset_failed_login, login_user, create_jwt_token",
    "JWT failure is non-blocking — tutor can still use monolith features. Cookie secure=False should be True in production."
  ),

  h2("Dashboard & Student Views"),

  ...funcBlock(
    "tutor_dashboard",
    "@tutor_bp.route('/tutor/dashboard')\n@role_required('tutor')\ndef tutor_dashboard():",
    "Main tutor dashboard. Aggregates slots, reviews, bookings, earnings stats, sessions-per-month chart data, profile completion, Stripe status, expiring documents.",
    [],
    "Renders tutor_dashboard.html with extensive template context.",
    [
      "Multiple DB reads: TutorSlot, Review, Booking, Payment, Assignment, TutorDocument",
      "Redirects to tutor_setup if onboarding_step < 5",
    ],
    [
      ["Onboarding incomplete", "Redirect to /tutor/setup", "Complete onboarding wizard"],
    ],
    "Navigation / direct URL",
    "calc_profile_completion, Booking.query, Payment.query, TutorSlot.query, Assignment.query, TutorDocument.query",
    "PERFORMANCE HOTSPOT: Loads ALL completed bookings and payments into memory to compute monthly stats. N+1 risk with tutor_earnings (queries Booking then TutorSlot per payment). Consider aggregation queries for large datasets.",
    ["// Chart data is serialized to JSON in the template context:", "sessions_monthly = json.dumps([{month: 'Jan 2026', count: 5}, ...])"]
  ),

  ...funcBlock(
    "book_session",
    "@tutor_bp.route('/book/<int:slot_id>', methods=['POST'])\n@limiter.limit('20 per hour', methods=['POST'])\ndef book_session(slot_id):",
    "The primary booking endpoint. Validates auth, email verification, guardian status, booking conflicts, slot availability. Uses SELECT FOR UPDATE to prevent double-booking. Creates booking, handles meeting location for in-person, redirects to payment or confirms free sessions.",
    [
      ["slot_id", "int", "Yes", "—", "URL parameter: ID of the TutorSlot to book"],
    ],
    "Redirect to payment checkout (paid) or student dashboard (free). Flash messages on errors.",
    [
      "DB WRITE: TutorSlot (status, student_id, current_students, jitsi_room_name)",
      "DB INSERT: Booking via do_create_booking()",
      "DB INSERT: StudentSavedLocation (if save_location requested)",
      "Cache invalidation: search:* and rec:* patterns",
      "External: video_service.generate_room_name() for online sessions",
      "Email: send_booking_emails() for free sessions",
      "Encryption: encrypt_field() for home addresses",
      "Event: booking.created published via event_bus",
    ],
    [
      ["Not authenticated", "Flash, redirect to login", "Login first"],
      ["Tutor booking own slot", "Flash warning", "Book a different tutor"],
      ["Email not verified", "Flash warning", "Verify email first"],
      ["Minor without guardian", "Flash warning", "Guardian must verify account"],
      ["Time conflict with existing booking", "Flash booking_conflict", "Choose different time"],
      ["Slot already booked (race condition)", "Rollback, flash warning", "SELECT FOR UPDATE prevents this in most cases"],
      ["Group session full", "Flash warning", "Choose another session"],
      ["Meeting location outside radius", "Flash warning with distance", "Choose location within radius"],
      ["General exception", "Rollback, flash error", "Retry"],
    ],
    "Tutor public profile page form, payment retry",
    "TutorSlot.query.with_for_update, do_create_booking, send_booking_emails, generate_room_name, cache_delete_pattern, encrypt_field, haversine_distance",
    "CRITICAL: This function does row-level locking (with_for_update) AND then calls do_create_booking which also does with_for_update — potential double-lock. The slot status is changed BEFORE do_create_booking is called, so the second lock in create_booking may see 'booked' status and fail.",
    [
      "# Booking a $50/hr session:",
      "POST /book/42",
      "# 1. Validates student auth + email + guardian",
      "# 2. Checks for time conflicts",
      "# 3. Locks slot row, marks as booked",
      "# 4. Creates Booking record",
      "# 5. Redirects to /payment/checkout/123",
    ]
  ),

  h2("Availability & Template Management"),

  ...funcBlock(
    "add_slot",
    "@tutor_bp.route('/tutor/add-slot', methods=['POST'])\n@role_required('tutor')\ndef add_slot():",
    "Creates a single availability slot. Handles group sessions (2-5 students), per-slot location for in-person modes, default vs custom location.",
    [],
    "Redirect to dashboard with flash message.",
    [
      "DB INSERT: TutorSlot",
    ],
    [
      ["Invalid date/time format", "Exception caught, flash error, rollback", "Fix form input"],
      ["DB error", "Rollback, flash error", "Retry"],
    ],
    "Availability page form",
    "datetime.strptime, sanitize_input_length, db.session.add/commit",
    "max_students clamped to 2-5 for groups. Price is a raw float() conversion — no max validation."
  ),

  ...funcBlock(
    "save_availability_template",
    "@tutor_bp.route('/tutor/availability/template', methods=['POST'])\n@role_required('tutor')\ndef save_availability_template():",
    "Saves a weekly availability template as JSON. Templates define recurring time blocks per day with mode, subject, price.",
    [],
    "Redirect to availability page.",
    ["DB UPDATE: Tutor.weekly_availability_template"],
    [["Invalid JSON", "Flash error", "Fix template data"], ["Invalid values", "ValueError caught", "Fix numeric values"]],
    "Availability template form",
    "json.loads, sanitize_input_length",
    "Max 10 blocks per day. Price clamped 0-9999. Time strings truncated to 5 chars."
  ),

  ...funcBlock(
    "generate_slots_from_template",
    "@tutor_bp.route('/tutor/availability/generate', methods=['POST'])\n@role_required('tutor')\ndef generate_slots_from_template():",
    "Generates concrete TutorSlot records from the saved weekly template for 1-8 weeks ahead. Skips duplicate slots.",
    [],
    "Redirect to availability page with count of created slots.",
    ["DB INSERT: Multiple TutorSlot records", "Deduplication check per slot"],
    [["No template saved", "Flash warning", "Save template first"]],
    "Availability page button",
    "TutorSlot.query.filter_by (dedup check), db.session.add",
    "Weeks clamped to 1-8. Skips dates in the past. Applies default tutor location for in-person slots."
  ),

  h2("Earnings & Export"),

  ...funcBlock(
    "tutor_earnings",
    "@tutor_bp.route('/tutor/earnings')\n@role_required('tutor')\ndef tutor_earnings():",
    "Displays earnings summary: total all-time, this month, this year, average per session, breakdown by subject.",
    [],
    "Renders tutor_earnings.html with aggregated payment data.",
    ["DB READ: All completed payments for tutor, then per-payment Booking + TutorSlot lookups"],
    [],
    "Dashboard link",
    "Payment.query, Booking.query.get, TutorSlot.query.get",
    "N+1 QUERY RISK: Iterates all payments and does individual Booking.query.get + TutorSlot.query.get per payment. For tutors with hundreds of sessions, this is slow. Use joinedload or a single joined query."
  ),

  ...funcBlock(
    "earnings_export",
    "@tutor_bp.route('/tutor/earnings/export')\n@role_required('tutor')\ndef earnings_export():",
    "Exports earnings data as CSV or PDF. Supports year and month filters. PDF includes summary box, monthly breakdown table, and detailed transaction table.",
    [],
    "CSV file download or PDF file download depending on format parameter.",
    ["DB READ: Payments filtered by year/month, with per-row Booking + Student + TutorSlot lookups"],
    [["No payments found", "Empty CSV/PDF", "Informational only"]],
    "Earnings page export button",
    "Payment.query, Booking.query.get, Student.query.get, TutorSlot.query.get, FPDF",
    "Same N+1 risk as tutor_earnings. PDF auto-paginates when y > 260."
  ),

  h2("Authentication Routes"),

  para("The following routes handle tutor authentication flows:"),
  makeTable(
    ["Function", "Route", "Purpose"],
    [
      ["forgot_password", "/tutor/forgot-password", "Rate limited (3/hr). Sends password reset email with signed token. Always shows success message (prevents email enumeration)."],
      ["reset_password", "/tutor/reset-password/<token>", "Validates signed token (1hr expiry), updates password, resets lockout."],
      ["logout", "/tutor/logout", "Calls logout_user(), redirects to index."],
      ["complete_tutor_onboarding", "/tutor/onboarding/complete", "Sets has_seen_tour=True. AJAX endpoint."],
    ],
    [2200, 3200, 3960]
  ),

  h2("Review Interaction Routes"),

  para("The following routes handle review responses, reporting, and voting:"),
  makeTable(
    ["Function", "Route", "Method", "Description"],
    [
      ["respond_to_review", "/tutor/review/<id>/respond", "POST", "Tutor writes response (min 10 chars, max 1000). One response per review."],
      ["report_review", "/review/<id>/report", "POST", "Any logged-in user reports a review. Reasons: spam, inappropriate, fake, other. One report per user per review."],
      ["vote_review", "/review/<id>/vote", "POST", "Toggle helpful/unhelpful vote. Cannot vote on own review. Returns updated counts."],
    ],
    [2000, 2800, 800, 3760]
  ),

  h2("Onboarding Wizard"),
  para("The tutor_setup route renders a 5-step wizard. tutor_setup_step(step_number) processes each step:"),
  makeTable(
    ["Step", "What It Collects", "Fields Updated"],
    [
      ["1", "Basic Profile — bio", "tutor.bio, onboarding_step=1"],
      ["2", "Teaching Details — rate, qualification, experience", "tutor.hourly_rate, qualification, experience, onboarding_step=2"],
      ["3", "Availability — just marks as viewed", "onboarding_step=3"],
      ["4", "Documents — just marks as viewed (skip option)", "onboarding_step=4"],
      ["5", "Stripe/Finish — marks complete", "onboarding_step=5"],
    ],
    [800, 4000, 4560]
  ),

  h2("Error Handling Summary"),
  makeTable(
    ["Function", "Exception Caught", "Handler Behavior", "Logged?", "Gap / Risk"],
    [
      ["edit_profile", "geocoding Exception", "Flash warning, continue", "Yes", "—"],
      ["register", "General Exception", "Rollback, flash error message", "No (shows to user)", "Error message may leak internal details"],
      ["login", "JWT creation Exception", "Swallowed with pass", "Yes", "Login succeeds without JWT — microservice auth breaks silently"],
      ["book_session", "General Exception", "Rollback, flash error", "No", "Error details shown to user"],
      ["add_slot", "General Exception", "Rollback, flash error", "No", "Same concern — error details to user"],
      ["earnings_export", "No try/except", "500 error if PDF generation fails", "No", "Missing error handling for PDF/CSV generation"],
    ],
    [1800, 2000, 2200, 800, 2560]
  ),

  h2("Inter-File Dependency Map"),
  para("tutor_routes.py is the most connected file in the codebase. It imports from: models (Tutor, TutorSlot, Review, Booking, Student, Payment, Assignment, TutorDocument, FavoriteTutor, RescheduleRequest, ReviewReport, ReviewVote, StudentSavedLocation), services (booking_service, email_service, encryption_service, storage_service, search_service, video_service, geocoding_service, cache_service), utils (sanitizer, auth, validators, categories, distance), and shared (jwt_auth)."),
  para("If this file were broken: tutors cannot register, login, manage profiles, create slots, or receive bookings. Students cannot book sessions. The entire tutor-student interaction flow stops. Payment initiation fails because book_session creates the booking that payment_routes depends on."),
];

sections.push(buildSection("routes/tutor_routes.py", tutorRoutesChildren));

// ═══════════════════════════════════════════════════════
// SECTION 2: routes/payment_routes.py
// ═══════════════════════════════════════════════════════
const paymentRoutesChildren = [
  h1("2. payment_routes.py (routes/payment_routes.py)"),

  h2("Overview"),
  para("Handles all payment-related HTTP endpoints: Stripe webhook processing, payment success/cancel pages, checkout flow with price breakdown, payment retry, Stripe Connect onboarding for tutors, PDF invoice generation, and self-service refund requests. This file is the bridge between the user-facing payment UI and the payment_service.py backend."),

  h2("Dependencies"),
  makeTable(
    ["Import", "Type", "Used For"],
    [
      ["stripe", "Third-party", "Stripe API — webhook signature verification, Account.retrieve"],
      ["flask (Blueprint, request, redirect, etc.)", "Third-party", "HTTP handling"],
      ["flask_login", "Third-party", "current_user, login_required"],
      ["models.booking.Booking", "Internal", "Booking lookups"],
      ["models.payment.Payment", "Internal", "Payment record queries"],
      ["models.tutor.Tutor", "Internal", "Tutor data for invoices"],
      ["models.slots.TutorSlot", "Internal", "Slot data for invoices"],
      ["services.booking_service.reopen_slot", "Internal", "Reopen slot on payment cancel"],
    ],
    [3600, 1400, 4360]
  ),

  ...funcBlock(
    "stripe_webhook",
    "@payment_bp.route('/payment/webhook', methods=['POST'])\ndef stripe_webhook():",
    "Receives Stripe webhook events. Verifies signature, processes checkout.session.completed events by calling process_successful_payment, sends confirmation emails, publishes payment.completed event.",
    [],
    "JSON {received: true} with 200 on success, or {error: 'Invalid signature'} with 400.",
    [
      "DB UPDATE: Payment status → completed, Booking status → Confirmed (via process_successful_payment)",
      "Email: booking confirmation to student and tutor",
      "Event: payment.completed published to Redis pub/sub",
    ],
    [
      ["Invalid Stripe signature", "400 JSON error", "Check webhook secret configuration"],
      ["Payment not found by checkout session ID", "process_successful_payment returns False", "Investigate orphaned Stripe session"],
      ["Email sending fails", "Caught, logged, does NOT block webhook response", "Emails may be missed — check logs"],
      ["Event publish fails", "Caught, logged, does NOT block", "Notification service may miss event"],
    ],
    "Stripe servers (inbound webhook)",
    "stripe.Webhook.construct_event, process_successful_payment, send_email, email_booking_confirmation, email_booking_tutor_notify, publish_event",
    "CRITICAL: No @login_required — this is an unauthenticated endpoint secured by Stripe signature verification. The confirmation email logic is duplicated here AND in the booking flow — if both run, double emails are possible (prevented by confirmation_email_sent flag)."
  ),

  ...funcBlock(
    "payment_checkout",
    "@payment_bp.route('/payment/checkout/<int:booking_id>')\n@login_required\ndef payment_checkout(booking_id):",
    "Shows price breakdown page before Stripe checkout. Calculates platform fee from PLATFORM_FEE_PERCENT config.",
    [["booking_id", "int", "Yes", "—", "Booking to show price for"]],
    "Renders payment_checkout.html with price, fee, and total.",
    ["DB READ: Booking, TutorSlot, Tutor"],
    [
      ["Booking not found", "404", "Invalid booking ID"],
      ["Wrong student", "Flash danger, redirect", "Access denied"],
      ["Booking not Pending Payment", "Flash warning, redirect", "Already paid or cancelled"],
    ],
    "book_session redirect",
    "Booking.query.get_or_404, TutorSlot.query.get, Tutor.query.get",
    null
  ),

  ...funcBlock(
    "payment_checkout_proceed",
    "@payment_bp.route('/payment/checkout/<int:booking_id>/proceed', methods=['POST'])\n@login_required\ndef payment_checkout_proceed(booking_id):",
    "Creates Stripe Checkout session and redirects student to Stripe-hosted payment page.",
    [["booking_id", "int", "Yes", "—", "Booking to pay for"]],
    "Redirect to Stripe checkout URL.",
    [
      "DB READ: Booking, Slot, Tutor, Student",
      "External API: Stripe Checkout Session creation via create_checkout_session()",
      "DB INSERT: Payment record (via create_checkout_session)",
    ],
    [
      ["Booking not found", "404", "Invalid booking ID"],
      ["Wrong student", "Flash danger, redirect", "Access denied"],
      ["Stripe API error", "Caught, flash danger, redirect to dashboard", "Retry later"],
    ],
    "Payment checkout page form submission",
    "create_checkout_session",
    null
  ),

  ...funcBlock(
    "payment_retry",
    "@payment_bp.route('/payment/retry/<int:booking_id>', methods=['POST'])\n@login_required\ndef payment_retry(booking_id):",
    "Retries a failed/cancelled payment. Creates a NEW booking and Stripe checkout session for the same slot.",
    [["booking_id", "int", "Yes", "—", "Original cancelled booking"]],
    "Redirect to Stripe checkout URL for the new booking.",
    [
      "DB WRITE: Slot status and student_id updated",
      "DB INSERT: New Booking record",
      "External API: create_checkout_session()",
    ],
    [
      ["Wrong student", "Flash danger, redirect", "Only original booker can retry"],
      ["Booking not Cancelled", "Flash warning", "Only cancelled bookings can be retried"],
      ["Slot no longer exists", "Flash danger", "Slot was deleted"],
      ["Slot date passed", "Flash warning", "Too late to retry"],
      ["Slot already booked (non-group)", "Flash warning", "Someone else booked it"],
      ["Group full", "Flash warning", "No space left"],
      ["Exception", "Rollback, flash danger, redirect to tutor profile", "Retry or re-book"],
    ],
    "Payment cancel page retry button",
    "create_checkout_session, Booking(), TutorSlot.query.get, db.session.flush/commit",
    "Creates a NEW booking rather than reusing the old one. The old cancelled booking remains in the DB. No row-level locking (with_for_update) — potential race condition for non-group slots."
  ),

  ...funcBlock(
    "download_invoice",
    "@payment_bp.route('/payment/<int:payment_id>/invoice')\n@login_required\ndef download_invoice(payment_id):",
    "Generates and downloads a PDF invoice using fpdf. Includes billing details, session info, payment table with fees and refunds.",
    [["payment_id", "int", "Yes", "—", "Payment to generate invoice for"]],
    "PDF file download (application/pdf) with filename TeachWise_Invoice_INV-NNNNNN.pdf.",
    ["DB READ: Payment, Booking, TutorSlot, Tutor, Student"],
    [
      ["Payment not found", "404", "Invalid ID"],
      ["Wrong student/tutor", "Flash danger, redirect", "Only involved parties can download"],
      ["Payment not completed/refunded", "Flash warning", "Invoice only for completed payments"],
    ],
    "Student bookings page, tutor earnings page",
    "FPDF, Payment.query, Booking, TutorSlot, Tutor, Student queries",
    "Invoice number format: INV-{payment.id:06d}. Refund line shown only if refund_amount > 0."
  ),

  ...funcBlock(
    "request_refund",
    "@payment_bp.route('/payment/<int:payment_id>/refund-request', methods=['GET', 'POST'])\n@login_required\ndef request_refund(payment_id):",
    "Student self-service refund request. GET shows form with refund percentage (based on time until session). POST creates RefundRequest record.",
    [["payment_id", "int", "Yes", "—", "Payment to request refund for"]],
    "GET: renders refund_request.html. POST: redirect to dashboard with success flash.",
    [
      "DB INSERT: RefundRequest record",
      "Refund % calculation via calculate_refund_percentage()",
    ],
    [
      ["Wrong student", "Flash danger, redirect", "Only the paying student"],
      ["Payment not completed", "Flash warning", "Can only refund completed payments"],
      ["Pending request exists", "Flash info", "Wait for existing request to be reviewed"],
      ["Empty reason", "Flash warning, redirect back", "Provide a reason"],
    ],
    "Student bookings page",
    "RefundRequest(), calculate_refund_percentage, Payment.query, TutorSlot.query",
    "Refund policy: >24h = 100%, 12-24h = 50%, <12h = 0%. Request is created but NOT auto-processed — admin must approve."
  ),

  para("The following routes are documented in summary form:"),
  makeTable(
    ["Function", "Route", "Purpose"],
    [
      ["payment_success", "/payment/success", "Shows success page after Stripe checkout. Reads booking_id from query params."],
      ["payment_cancel", "/payment/cancel", "Handles cancelled payment. Reopens slot, marks booking as Cancelled, marks payment as failed."],
      ["stripe_onboard", "/tutor/stripe-onboard", "Initiates Stripe Connect onboarding for tutor. Calls create_connect_account_link()."],
      ["stripe_callback", "/tutor/stripe-callback", "Callback after Stripe onboarding. Verifies account.charges_enabled, sets stripe_onboarding_complete."],
    ],
    [2200, 2600, 4560]
  ),

  h2("Error Handling Summary"),
  makeTable(
    ["Function", "Exception Caught", "Handler Behavior", "Logged?", "Gap / Risk"],
    [
      ["stripe_webhook", "ValueError, SignatureVerificationError", "Returns 400", "No", "Invalid webhooks not logged — hard to debug"],
      ["stripe_webhook", "Email/event Exception", "Caught, logged, 200 still returned", "Yes", "Correct — webhook must always return 200"],
      ["payment_retry", "General Exception", "Rollback, flash, redirect", "Yes", "Good error handling"],
      ["stripe_callback", "Stripe API Exception", "Caught, flash danger", "Yes", "—"],
      ["payment_cancel", "No try/except on commit", "Unhandled on DB error", "No", "payment_cancel should wrap DB ops in try/except"],
    ],
    [1800, 2400, 2000, 800, 2360]
  ),
];

sections.push(buildSection("routes/payment_routes.py", paymentRoutesChildren));

// ═══════════════════════════════════════════════════════
// Continue in Part 2...
// We'll write remaining sections to a separate file and require it
// ═══════════════════════════════════════════════════════

// For now, export what we need
module.exports = { sections, buildSection, h1, h2, h3, h4, para, txt, codeTxt, bullet, numItem,
  codeBlock, makeTable, infoBox, funcBlock, spacer, C, FONT, CODE_FONT };
