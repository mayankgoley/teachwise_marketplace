"""OpenAI function-calling tool definitions and dispatch."""

import json
from chatbot.backend import platform_client

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_user_profile",
            "description": "Retrieve profile information for a student or tutor.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "integer", "description": "The user ID"},
                    "user_role": {"type": "string", "enum": ["student", "tutor"]}
                },
                "required": ["user_id", "user_role"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_bookings",
            "description": "Get a list of bookings for a user. Can filter by status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "integer"},
                    "user_role": {"type": "string", "enum": ["student", "tutor"]},
                    "status": {"type": "string", "description": "Filter: Confirmed, Cancelled, or all"},
                    "limit": {"type": "integer", "default": 10}
                },
                "required": ["user_id", "user_role"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_booking_details",
            "description": "Get full details for a specific booking including slot, tutor, student, and payment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_id": {"type": "integer"}
                },
                "required": ["booking_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_refund",
            "description": "Calculate the refund amount for a booking based on the cancellation policy.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_id": {"type": "integer"}
                },
                "required": ["booking_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_booking",
            "description": "Cancel a booking. Always confirm with the user before calling.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_id": {"type": "integer"},
                    "reason": {"type": "string"},
                    "cancelled_by": {"type": "string", "enum": ["student", "tutor", "admin"]}
                },
                "required": ["booking_id", "reason", "cancelled_by"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_refund_status",
            "description": "Check the refund status for a booking.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_id": {"type": "integer"}
                },
                "required": ["booking_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_tutors",
            "description": "Search for tutors. Can filter by subject, teaching mode, rating, and price.",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {"type": "string"},
                    "mode": {"type": "string", "enum": ["Online", "In-person", "Both"]},
                    "min_rating": {"type": "number"},
                    "max_price": {"type": "number"},
                    "limit": {"type": "integer", "default": 10}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_tutor_slots",
            "description": "Get available time slots for a specific tutor.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tutor_id": {"type": "integer"},
                    "date_from": {"type": "string", "description": "YYYY-MM-DD"},
                    "date_to": {"type": "string", "description": "YYYY-MM-DD"},
                    "mode": {"type": "string"}
                },
                "required": ["tutor_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_payment_status",
            "description": "Get payment status and details for a booking.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_id": {"type": "integer"}
                },
                "required": ["booking_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_to_human",
            "description": "Escalate the conversation to a human support agent.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                    "summary": {"type": "string"}
                },
                "required": ["reason", "priority", "summary"]
            }
        }
    },
]

_HANDLERS = {
    'get_user_profile': platform_client.get_user_profile,
    'get_user_bookings': platform_client.get_user_bookings,
    'get_booking_details': platform_client.get_booking_details,
    'calculate_refund': platform_client.calculate_refund,
    'cancel_booking': platform_client.cancel_booking,
    'get_refund_status': platform_client.get_refund_status,
    'search_tutors': platform_client.search_tutors,
    'get_tutor_slots': platform_client.get_tutor_slots,
    'get_payment_status': platform_client.get_payment_status,
}


def dispatch_tool(name, arguments, conversation_id=None):
    if name == 'escalate_to_human':
        return _handle_escalation(arguments, conversation_id)

    handler = _HANDLERS.get(name)
    if not handler:
        return {'error': f'Unknown tool: {name}'}

    args = json.loads(arguments) if isinstance(arguments, str) else arguments
    try:
        return handler(**args)
    except TypeError as e:
        return {'error': f'Invalid arguments for {name}: {e}'}


def _handle_escalation(arguments, conversation_id):
    args = json.loads(arguments) if isinstance(arguments, str) else arguments
    from database import db
    from chatbot.backend.models import ChatbotConversation

    if conversation_id:
        conv = ChatbotConversation.query.get(conversation_id)
        if conv:
            conv.status = 'escalated'
            conv.escalation_reason = args.get('reason', '')
            db.session.commit()

    return {
        'status': 'escalated',
        'reason': args.get('reason', ''),
        'priority': args.get('priority', 'medium'),
        'message': 'Conversation has been escalated to a human agent.',
    }
