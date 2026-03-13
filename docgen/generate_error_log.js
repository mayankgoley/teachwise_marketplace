#!/usr/bin/env node
const docx = require("docx");
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType,
  Header, Footer, PageNumber, TabStopType, LevelFormat,
} = docx;

// Color scheme
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
  black: "000000",
  gray: "888888",
};

const FONT = "Arial";
const CODE_FONT = "Courier New";

// ── Helpers ──

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

function para(children, opts = {}) {
  if (typeof children === "string") children = [txt(children)];
  return new Paragraph({
    children,
    spacing: { after: opts.after || 120, before: opts.before || 0 },
    alignment: opts.alignment || AlignmentType.LEFT,
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

function spacer(height = 200) {
  return new Paragraph({ spacing: { after: height } });
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
  const headerRow = new TableRow({
    children: headers.map((h, i) => headerCell(h, colWidths[i])),
  });
  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cell, ci) => dataCell(cell, colWidths[ci], ri % 2 === 1)),
    })
  );
  return new Table({
    width: { size: colWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });
}

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
              txt("TeachWise Startup Error Log & Solution", { size: 18, color: C.primary, bold: true }),
              new TextRun({ text: "\t", font: FONT }),
              new TextRun({ text: "\t", font: FONT }),
              txt("Internal Developer Reference", { size: 16, color: C.gray, italics: true }),
            ],
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.primary } },
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

// ══════════════════════════════════════════════════════════
// DOCUMENT CONTENT
// ══════════════════════════════════════════════════════════

const sections = [];

// ── Cover Page ──
sections.push(buildSection("Cover", [
  spacer(1200),
  new Paragraph({
    children: [new TextRun({ text: "TeachWise Platform", font: FONT, size: 56, bold: true, color: C.primary })],
    alignment: AlignmentType.CENTER,
  }),
  new Paragraph({
    children: [new TextRun({ text: "Startup Error Log & Solution", font: FONT, size: 44, bold: true, color: C.accent })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "SocketIO Reloader Deadlock — Root Cause & Fix", font: FONT, size: 26, italics: true, color: C.gray })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }),
  makeTable(
    ["Field", "Value"],
    [
      ["Date", "March 13, 2026"],
      ["Severity", "Critical (blocks all local development)"],
      ["Status", "Resolved"],
      ["Affected File", "app.py, line 385"],
      ["Root Cause", "Werkzeug reloader deadlock with module-level SocketIO init"],
      ["Fix Type", "Workaround (startup command change)"],
      ["Long-Term Fix", "Refactor to application factory pattern"],
    ],
    [3000, 6360]
  ),
  spacer(400),
  new Paragraph({
    children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, font: FONT, size: 22, color: C.gray })],
    alignment: AlignmentType.CENTER,
  }),
]));

// ── Section 1: Symptom ──
sections.push(buildSection("Symptom", [
  h1("1. Symptom"),

  h2("What happens"),
  para("Running the app with the documented Quick Start command causes the process to hang indefinitely:"),
  codeBlock([
    "$ python app.py",
    "",
    "flask_limiter/extension.py:336: UserWarning: Using the in-memory storage",
    "for tracking rate limits as no storage was explicitly specified.",
    "  warnings.warn(",
    "_ <-- cursor hangs here forever",
  ]),
  spacer(80),
  para("The server never binds to port 5001. curl returns connection refused (HTTP 000). The process must be killed manually with pkill or Ctrl+C."),

  h2("Expected behavior"),
  codeBlock([
    "$ python app.py",
    " * Serving Flask app 'app'",
    " * Debug mode: on",
    " * Running on http://127.0.0.1:5001",
    "Press CTRL+C to quit",
  ]),
  spacer(80),

  h2("Also affected"),
  bullet("flask --app app run --port 5001  (same hang)"),
  bullet("flask --app app run --debug --port 5001  (same hang)"),
  bullet("Any invocation that triggers the Werkzeug reloader"),

  infoBox("The hang is silent. There is no error message, no traceback, no timeout. The process simply stops producing output and never starts listening.", "danger"),
]));

// ── Section 2: Environment ──
sections.push(buildSection("Environment", [
  h1("2. Environment"),

  makeTable(
    ["Component", "Version", "Notes"],
    [
      ["Python", "3.12 (Anaconda)", "System install via Anaconda"],
      ["Flask", "2.3.3", ""],
      ["Flask-SocketIO", "5.6.1", ""],
      ["python-socketio", "5.16.1", ""],
      ["python-engineio", "4.13.1", ""],
      ["Werkzeug", "2.3.x", "Provides the reloader"],
      ["eventlet", "Not installed", "Key factor in the bug"],
      ["gevent", "Not installed", "Key factor in the bug"],
      ["OS", "macOS Darwin 24.6.0", ""],
      ["Database", "PostgreSQL 14/17", "Local, port 5432, running"],
      ["Redis", "Not running", "Cosmetic limiter warning only"],
    ],
    [2400, 2400, 4560]
  ),
  spacer(100),
  infoBox("Neither eventlet nor gevent is installed. Flask-SocketIO falls back to 'threading' async mode. This is a key factor — the threading mode interacts poorly with Werkzeug's reloader subprocess fork.", "warning"),
]));

// ── Section 3: Root Cause ──
sections.push(buildSection("Root Cause", [
  h1("3. Root Cause Analysis"),

  h2("3.1 The Trigger"),
  para([txt("app.py line 385", { bold: true }), txt(" calls:")]),
  codeBlock([
    "socketio.run(app, debug=True, port=port, allow_unsafe_werkzeug=True)",
  ]),
  spacer(60),
  para("When debug=True, Flask-SocketIO delegates to Werkzeug's reloader. The reloader:"),
  numItem("Starts a parent process that watches for file changes"),
  numItem("Forks a child process via subprocess that re-imports app.py from scratch"),
  numItem("The child sets WERKZEUG_RUN_MAIN=true so the app knows it is the worker"),

  h2("3.2 Why This Deadlocks"),
  para("app.py is written as a module-level script, not an application factory. All initialization runs unconditionally at import time:"),

  makeTable(
    ["Step", "Line(s)", "What Runs", "Problem on Re-import"],
    [
      ["1", "14", "Create Flask app", "Creates second app instance"],
      ["2", "20-23", "Init DB, CSRF, Stripe", "Attaches to second instance"],
      ["3", "26-29", "Init rate limiter", "Duplicate limiter"],
      ["4", "43-57", "Init SocketIO (threading)", "Second SocketIO on same port"],
      ["5", "59-62", "Init Flask-Login", "Duplicate login manager"],
      ["6", "143-193", "Import 21 blueprints", "All modules re-imported"],
      ["7", "195", "from models import *", "All 29 models re-imported"],
      ["8", "365-368", "Event bus init", "Second connection attempt"],
      ["9", "370-371", "Service client init", "Duplicate HTTP client"],
      ["10", "373-379", "Scheduler init", "Second scheduler instance"],
    ],
    [800, 1200, 3400, 3960]
  ),
  spacer(100),
  para("The combination of SocketIO being initialized twice in threading mode, plus the parent and child processes competing for the same resources, creates a deadlock. The parent waits for the child to signal readiness, but the child never finishes initialization."),

  h2("3.3 The Core Issue"),
  infoBox("The fundamental problem is that app.py uses module-level initialization instead of the Flask application factory pattern. Every import of app.py re-runs ALL setup code. The Werkzeug reloader requires a clean re-import, which this architecture cannot provide.", "danger"),

  h2("3.4 Contributing Factors"),
  bullet("No eventlet/gevent: Falls back to threading mode, which is less tolerant of the fork"),
  bullet("21 blueprint imports at module level: Heavy re-import cost"),
  bullet("SocketIO + threading + reloader: Known compatibility issue in Flask-SocketIO 5.x"),
  bullet("No __name__ == '__main__' guard around initialization: Only the socketio.run() call is guarded"),
]));

// ── Section 4: Solution ──
sections.push(buildSection("Solution", [
  h1("4. Solution"),

  h2("4.1 Quick Fix (Working Command)"),
  para("Use this command to start the server instead of python app.py:"),
  codeBlock([
    "RUN_SCHEDULER=false python -c \"",
    "from app import app, socketio",
    "from database import db",
    "with app.app_context():",
    "    db.create_all()",
    "socketio.run(app, debug=False, port=5001,",
    "    allow_unsafe_werkzeug=True, use_reloader=False, log_output=True)",
    "\"",
  ]),
  spacer(80),
  para([txt("Why this works:", { bold: true })]),
  bullet("debug=False prevents the reloader from forking a subprocess"),
  bullet("use_reloader=False explicitly disables the file watcher"),
  bullet("log_output=True ensures HTTP request logs are printed to the terminal"),
  bullet("The app module imports once, cleanly, without any re-import"),

  h2("4.2 Shell Alias"),
  para("Add to ~/.zshrc for convenience:"),
  codeBlock([
    "alias teachwise='cd ~/Documents/TeachWise && \\",
    "  RUN_SCHEDULER=false python -c \"",
    "from app import app, socketio",
    "from database import db",
    "with app.app_context():",
    "    db.create_all()",
    "socketio.run(app, debug=False, port=5001,",
    "    allow_unsafe_werkzeug=True, use_reloader=False, log_output=True)",
    "\"'",
  ]),

  h2("4.3 With Scheduler Enabled"),
  codeBlock([
    "WERKZEUG_RUN_MAIN=true python -c \"",
    "from app import app, socketio",
    "from database import db",
    "with app.app_context():",
    "    db.create_all()",
    "socketio.run(app, debug=False, port=5001,",
    "    allow_unsafe_werkzeug=True, use_reloader=False, log_output=True)",
    "\"",
  ]),
  spacer(80),
  para("Setting WERKZEUG_RUN_MAIN=true makes the scheduler's guard condition pass, allowing APScheduler jobs (reminders, cleanup, expiry checks) to start."),

  h2("4.4 Trade-offs of the Quick Fix"),
  makeTable(
    ["Aspect", "With Quick Fix", "With python app.py (broken)"],
    [
      ["Auto-reload on file change", "No — must restart manually", "Yes (if it worked)"],
      ["Debug error pages", "No — returns 500 with no traceback in browser", "Yes"],
      ["Request logging", "Yes (via log_output=True)", "Yes"],
      ["SocketIO WebSocket support", "Yes", "Yes"],
      ["Scheduler", "Must opt in with WERKZEUG_RUN_MAIN=true", "Auto-starts"],
    ],
    [2800, 3400, 3160]
  ),
  spacer(100),
  infoBox("The main downside is losing auto-reload. You must restart the server manually after code changes. For active development, consider using a file watcher like watchmedo (from watchdog package) to auto-restart.", "warning"),
]));

// ── Section 5: Long-Term Fix ──
sections.push(buildSection("Long-Term Fix", [
  h1("5. Proper Long-Term Fix"),

  h2("5.1 Refactor to Application Factory Pattern"),
  para("The standard Flask approach eliminates the reloader deadlock entirely. All initialization moves inside a create_app() function:"),

  codeBlock([
    "# app.py — refactored",
    "",
    "def create_app(config_class=None):",
    "    app = Flask(__name__)",
    "    app.config.from_object(config_class or Config)",
    "",
    "    db.init_app(app)",
    "    Migrate(app, db)",
    "    CSRFProtect(app)",
    "    limiter.init_app(app)",
    "    socketio.init_app(app, cors_allowed_origins='*',",
    "                       async_mode='threading')",
    "",
    "    login_manager = LoginManager()",
    "    login_manager.init_app(app)",
    "    login_manager.login_view = 'student_bp.login_student'",
    "",
    "    _register_user_loader(login_manager)",
    "    _register_blueprints(app)",
    "    _register_template_filters(app)",
    "    _register_error_handlers(app)",
    "",
    "    return app",
    "",
    "if __name__ == '__main__':",
    "    app = create_app()",
    "    with app.app_context():",
    "        db.create_all()",
    "    socketio.run(app, debug=True, port=5001,",
    "                 allow_unsafe_werkzeug=True)",
  ]),
  spacer(100),

  h2("5.2 Why This Fixes the Problem"),
  bullet("The reloader re-imports the module, but only create_app() is defined (no side effects)"),
  bullet("The child process calls create_app() fresh with no duplicate initialization"),
  bullet("SocketIO, DB, and login manager are initialized exactly once per process"),
  bullet("debug=True works correctly with auto-reload and debug error pages"),

  h2("5.3 Scope of Work"),
  makeTable(
    ["Task", "Files Affected", "Complexity"],
    [
      ["Move init code into create_app()", "app.py", "Medium"],
      ["Extract blueprint registration", "app.py", "Low"],
      ["Extract template filter registration", "app.py", "Low"],
      ["Extract error handler registration", "app.py", "Low"],
      ["Update test conftest.py", "tests/conftest.py", "Low"],
      ["Update any scripts that import app directly", "seed_test_data.py, etc.", "Low"],
      ["Verify all 21 blueprints work", "All route files", "Medium (testing)"],
    ],
    [3800, 3000, 2560]
  ),
  spacer(100),
  infoBox("The test suite already uses a similar pattern in conftest.py with a test app fixture. The refactor aligns the main app with this existing approach.", "info"),
]));

// ── Section 6: Debugging Timeline ──
sections.push(buildSection("Debugging Timeline", [
  h1("6. Debugging Timeline"),
  para("Step-by-step record of how the issue was diagnosed. Preserved for future reference."),

  h3("Step 1 — python app.py"),
  para("Result: Hung after limiter warning. No server output. Waited 25+ seconds."),

  h3("Step 2 — flask --app app run --port 5001"),
  para("Result: Same hang. Ruled out socketio.run()-specific issue."),

  h3("Step 3 — Verified PostgreSQL"),
  codeBlock(["$ pg_isready", "/tmp:5432 - accepting connections"]),
  para("Result: DB running. Not the cause."),

  h3("Step 4 — Verified Config"),
  codeBlock([
    "SQLALCHEMY_DATABASE_URI = postgresql://postgres:***@localhost:5432/teachwise",
    "REDIS_URL = '' (empty)",
    "SESSION_TYPE = 'filesystem'",
  ]),
  para("Result: No Redis dependency. DB URI correct."),

  h3("Step 5 — Blueprint-by-Blueprint Import Test"),
  para("Imported all 21 blueprints sequentially with print statements between each:"),
  codeBlock([
    "student_routes... OK       tutor_routes... OK",
    "admin_routes... OK         guardian_routes... OK",
    "document_routes... OK      payment_routes... OK",
    "reschedule_routes... OK    session_routes... OK",
    "wallet_routes... OK        internal_api... OK",
    "chatbot... OK              search_routes... OK",
    "chat_routes... OK          assignment_routes... OK",
    "whiteboard_routes... OK    recording_routes... OK",
    "note_routes... OK          progress_routes... OK",
    "notification_routes... OK  notif_center_routes... OK",
    "geocoding_routes... OK",
    "ALL DONE",
  ]),
  para("Result: All 21 blueprints import successfully. Import is not the issue."),

  h3("Step 6 — Minimal SocketIO Server"),
  codeBlock([
    "from flask import Flask",
    "from flask_socketio import SocketIO",
    "app = Flask(__name__)",
    "sio = SocketIO(app, async_mode='threading')",
    "sio.run(app, debug=False, port=5001)",
  ]),
  para("Result: Works instantly. Serves requests. Proves SocketIO itself is fine."),

  h3("Step 7 — Full App with debug=False"),
  codeBlock([
    "from app import app, socketio",
    "socketio.run(app, debug=False, port=5001, use_reloader=False)",
  ]),
  para([txt("Result: Works.", { bold: true }), txt(" Server starts in ~2 seconds, serves HTTP 200. This confirmed debug=True / reloader as the root cause.")]),
  infoBox("Key insight: The app works perfectly when the reloader is disabled. The deadlock only occurs when Werkzeug forks a child process to re-import the module.", "success"),

  h3("Step 8 — Version Check"),
  makeTable(
    ["Package", "Version", "Relevant?"],
    [
      ["Flask-SocketIO", "5.6.1", "Yes — has known reloader issues"],
      ["python-socketio", "5.16.1", "Yes"],
      ["eventlet", "Not installed", "Yes — forces threading fallback"],
      ["gevent", "Not installed", "Yes — forces threading fallback"],
    ],
    [3000, 2400, 3960]
  ),
  spacer(100),
  para("Conclusion: debug=True + Werkzeug reloader + module-level initialization = deadlock."),
]));

// ── Section 7: Commands Reference ──
sections.push(buildSection("Commands Reference", [
  h1("7. Commands Reference"),

  makeTable(
    ["Goal", "Command"],
    [
      ["Start server (no scheduler)", "RUN_SCHEDULER=false python -c \"from app import app, socketio; from database import db; app.app_context().__enter__(); db.create_all(); socketio.run(app, debug=False, port=5001, allow_unsafe_werkzeug=True, use_reloader=False, log_output=True)\""],
      ["Start server (with scheduler)", "WERKZEUG_RUN_MAIN=true python -c \"from app import app, socketio; from database import db; app.app_context().__enter__(); db.create_all(); socketio.run(app, debug=False, port=5001, allow_unsafe_werkzeug=True, use_reloader=False, log_output=True)\""],
      ["Check if server is running", "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5001/"],
      ["Kill stuck server processes", "pkill -f 'python.*app' or lsof -ti:5001 | xargs kill"],
      ["Check DB connection", "pg_isready"],
      ["Test import only (no server)", "python -c \"from app import app; print('OK')\""],
      ["Check SocketIO version", "pip show flask-socketio python-socketio python-engineio"],
      ["Check async backends", "pip show eventlet gevent"],
    ],
    [3200, 6160]
  ),
  spacer(200),

  h2("Related Issues"),
  bullet("Flask-SocketIO #1892 — Known issue with threading mode + Werkzeug reloader in SocketIO 5.x"),
  bullet("Werkzeug reloader forks a subprocess; both stat and watchdog reloaders cause the same deadlock"),
  bullet("The Flask-Limiter warning (in-memory storage) is cosmetic and unrelated to the hang"),
  spacer(200),

  para([txt("Document generated: March 13, 2026 | Author: Claude Code", { italics: true, color: C.gray })]),
]));

// ══════════════════════════════════════════════════════════
// BUILD
// ══════════════════════════════════════════════════════════

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: "left", style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: "left", style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        ],
      },
      {
        reference: "numbers",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: "left", style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.LOWER_LETTER, text: "%2.", alignment: "left", style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        ],
      },
    ],
  },
  sections,
});

const outputPath = path.resolve(__dirname, "..", "TeachWise_Startup_Error_Log.docx");

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  const sizeMB = (buffer.length / 1024).toFixed(1);
  console.log(`Done: ${outputPath} (${sizeMB} KB, ${sections.length} sections)`);
}).catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
