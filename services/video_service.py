import secrets


JITSI_DOMAIN = "meet.jit.si"


def generate_room_name(slot_id):
    return f"tw-{slot_id}-{secrets.token_hex(8)}"


def get_jitsi_url(room_name):
    return f"https://{JITSI_DOMAIN}/{room_name}"
