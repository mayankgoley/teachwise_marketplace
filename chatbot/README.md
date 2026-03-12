# Chatbot Module

Self-contained AI support chatbot using OpenAI gpt-4o with function calling.

## Setup

### 1. Install dependency

```bash
pip install openai
```

### 2. Environment variable

Add to your `.env`:

```
OPENAI_API_KEY=sk-your-key-here
```

### 3. Register the blueprint

Add these two lines to `app.py` (after existing blueprint registrations):

```python
# Chatbot widget
from chatbot import register_chatbot
register_chatbot(app)
```

### 4. Mount the widget

Add this single line to `templates/base.html` before `{% block extra_js %}`:

```html
<!-- Chatbot Widget -->
<script src="/api/chatbot/static/chatbot.js" defer></script>
```

The JS auto-loads its own CSS. No other imports needed.

### 5. Database tables

The chatbot uses two tables: `chatbot_conversations` and `chatbot_messages`.

If the migration `ab21d211205d_add_chatbot_tables.py` has already been applied,
no action needed. Otherwise, create a migration:

```bash
flask --app app db migrate -m "add chatbot tables"
flask --app app db upgrade
```

## API Endpoints

All routes are under `/api/chatbot/`:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chatbot/conversations` | Start or resume a conversation |
| GET | `/api/chatbot/conversations/active` | Get current user's active conversation |
| GET | `/api/chatbot/conversations/<id>` | Get conversation with messages |
| POST | `/api/chatbot/conversations/<id>/messages` | Send a message, get AI reply |
| PATCH | `/api/chatbot/conversations/<id>/resolve` | Mark conversation resolved |

## Platform API Dependencies

The chatbot calls your platform's internal APIs to fetch data for tool calls.
These are defined as **stub functions** in `chatbot/backend/platform_client.py`.

Each stub documents the endpoint it expects. **You need to wire these up** by
either creating the endpoints or replacing the function bodies.

### Expected endpoints

| Function | Expected endpoint | Purpose |
|----------|-------------------|---------|
| `get_user_profile` | `GET /api/internal/user/<id>?role=X` | User profile data |
| `get_user_bookings` | `GET /api/internal/bookings?user_id=X&role=Y` | List bookings |
| `get_booking_details` | `GET /api/internal/bookings/<id>` | Single booking detail |
| `cancel_booking` | `POST /api/internal/bookings/<id>/cancel` | Cancel a booking |
| `calculate_refund` | `GET /api/internal/bookings/<id>/refund-estimate` | Refund calculation |
| `get_refund_status` | `GET /api/internal/payments?booking_id=X` | Refund status |
| `get_payment_status` | `GET /api/internal/payments?booking_id=X` | Payment info |
| `search_tutors` | `GET /api/internal/tutors/search?subject=X` | Search tutors |
| `get_tutor_slots` | `GET /api/internal/tutors/<id>/slots` | Tutor availability |

If these endpoints don't exist yet, the chatbot still works for general
conversation — tool calls will return "not wired up" errors and the AI will
gracefully tell the user it can't access that data.

## Assumptions

- **Auth:** Uses Flask-Login (`current_user`) to identify the logged-in user.
  Guest users can chat but can't access account-specific features.
- **CSRF:** The widget reads the `csrf-token` meta tag from the page and sends
  it as `X-CSRFToken` header. The blueprint is also CSRF-exempted via
  `register_chatbot()`.
- **FontAwesome:** The widget uses FontAwesome icon classes (`fas fa-*`). It
  assumes FontAwesome is already loaded on the page.
- **Database:** Uses the app's existing SQLAlchemy `db` instance from
  `database.py`. Tables have the `chatbot_` prefix and don't touch existing tables.
- **Model:** OpenAI gpt-4o with 1024 max tokens, 5 max tool call rounds.

## File Structure

```
chatbot/
  __init__.py              # register_chatbot(app) entry point
  README.md                # This file
  backend/
    __init__.py
    models.py              # ChatbotConversation, ChatbotMessage
    routes.py              # Flask blueprint (/api/chatbot/*)
    service.py             # OpenAI integration + conversation logic
    tools.py               # Function calling definitions + dispatch
    platform_client.py     # Stub HTTP client for platform APIs
  frontend/
    chatbot.js             # Self-contained widget (auto-loads CSS)
    chatbot.css            # Widget animations and styles
```
