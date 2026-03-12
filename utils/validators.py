import re


def validate_password_complexity(password):
    if not password or len(password) < 12:
        return False
    if not re.search(r'[A-Z]', password):
        return False
    if not re.search(r'[0-9]', password):
        return False
    if not re.search(r'[!@#$%^&*()_\-+=\[\]{};:\'",.<>?/\\|`~]', password):
        return False
    return True


def get_password_error_message(password):
    if not password:
        return 'Password is required.'
    if len(password) < 12:
        return 'Password must be at least 12 characters.'
    if not re.search(r'[A-Z]', password):
        return 'Password must contain at least one uppercase letter.'
    if not re.search(r'[0-9]', password):
        return 'Password must contain at least one number.'
    if not re.search(r'[!@#$%^&*()_\-+=\[\]{};:\'",.<>?/\\|`~]', password):
        return 'Password must contain at least one special character (!@#$%^&* etc.).'
    return None


def validate_email_format(email):
    if not email:
        return None
    email = email.strip().lower()
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        return None
    if len(email) > 120:
        return None
    return email


def validate_name(name, max_length=100):
    if not name:
        return '', 'Name is required.'

    clean_name = name.strip()
    if not clean_name:
        return '', 'Name cannot be only whitespace.'

    if len(clean_name) > max_length:
        return '', f'Name must be {max_length} characters or less.'

    if re.search(r'<[^>]+>', clean_name):
        return '', 'Name cannot contain HTML tags.'

    return clean_name, None


def validate_phone(phone):
    if not phone:
        return '', None

    clean_phone = phone.strip()
    if not clean_phone:
        return '', None

    pattern = r'^[\d\+\-\(\)\s]{7,}$'
    if not re.match(pattern, clean_phone):
        return '', 'Phone must contain at least 7 digits and only digits, +, -, (), or spaces.'

    digit_count = sum(1 for c in clean_phone if c.isdigit())
    if digit_count < 7:
        return '', 'Phone must contain at least 7 digits.'

    return clean_phone, None


def validate_url(url):
    if not url:
        return '', None

    clean_url = url.strip()
    if not clean_url:
        return '', None

    if not (clean_url.startswith('http://') or clean_url.startswith('https://')):
        return '', 'URL must start with http:// or https://.'

    pattern = r'^https?://[a-zA-Z0-9\-._~:/?#\[\]@!$&\'()*+,;=%]+$'
    if not re.match(pattern, clean_url):
        return '', 'URL format is invalid.'

    if len(clean_url) > 2048:
        return '', 'URL must be 2048 characters or less.'

    return clean_url, None


def validate_date_of_birth(dob_str, min_age=0, max_age=120):
    from datetime import datetime, date as date_class

    if not dob_str:
        return None, 'Date of birth is required.'

    try:
        dob = datetime.strptime(str(dob_str).strip(), '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None, 'Date of birth must be in format YYYY-MM-DD.'

    today = date_class.today()
    if dob > today:
        return None, 'Date of birth cannot be in the future.'

    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

    if age < min_age:
        return None, f'You must be at least {min_age} years old.'

    if age > max_age:
        return None, f'Date of birth appears invalid (age > {max_age}).'

    return dob, None
