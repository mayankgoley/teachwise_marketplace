import bleach


def sanitize_text(text):
    """Strip ALL HTML tags. Use for: bio, comments, names, feedback."""
    if text is None:
        return None
    cleaned = bleach.clean(str(text).strip(), tags=[], strip=True)
    return cleaned or None


def sanitize_rich_text(text):
    """Allow only safe formatting tags. Use for fields needing basic formatting."""
    if text is None:
        return None
    allowed_tags = ['p', 'br', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li']
    cleaned = bleach.clean(str(text).strip(), tags=allowed_tags, strip=True)
    return cleaned or None


def sanitize_input_length(text, max_length):
    """Sanitize and enforce max length."""
    sanitized = sanitize_text(text)
    if sanitized and len(sanitized) > max_length:
        return sanitized[:max_length]
    return sanitized
