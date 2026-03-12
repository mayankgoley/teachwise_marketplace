"""Tests for input validation utilities."""
import pytest
from utils.validators import (
    validate_password_complexity, get_password_error_message,
    validate_email_format, validate_name, validate_phone,
    validate_url, validate_date_of_birth,
)


class TestPasswordComplexity:
    def test_valid_password(self):
        assert validate_password_complexity('StrongPass1!@') is True

    def test_too_short(self):
        assert validate_password_complexity('Short1!') is False

    def test_no_uppercase(self):
        assert validate_password_complexity('nouppercase1!@') is False

    def test_no_number(self):
        assert validate_password_complexity('NoNumberHere!@') is False

    def test_no_special_char(self):
        assert validate_password_complexity('NoSpecialChar1') is False

    def test_empty_password(self):
        assert validate_password_complexity('') is False
        assert validate_password_complexity(None) is False

    def test_error_message_specificity(self):
        msg = get_password_error_message('short')
        assert 'at least 12' in msg.lower()


class TestEmailFormat:
    def test_valid_email(self):
        result = validate_email_format('user@example.com')
        assert result == 'user@example.com'

    def test_email_trimming(self):
        result = validate_email_format('  User@Example.COM  ')
        assert result == 'user@example.com'

    def test_invalid_email(self):
        assert validate_email_format('not-an-email') is None
        assert validate_email_format('') is None


class TestNameValidation:
    def test_valid_name(self):
        name, err = validate_name('John Doe')
        assert name == 'John Doe'
        assert err is None

    def test_empty_name(self):
        name, err = validate_name('')
        assert err is not None

    def test_html_in_name(self):
        name, err = validate_name('<script>alert("xss")</script>')
        assert err is not None

    def test_max_length(self):
        name, err = validate_name('A' * 200, max_length=100)
        assert err is not None


class TestPhoneValidation:
    def test_valid_phone(self):
        phone, err = validate_phone('+1 (555) 123-4567')
        assert err is None

    def test_empty_phone_is_ok(self):
        phone, err = validate_phone('')
        assert err is None  # phone is optional

    def test_invalid_phone(self):
        phone, err = validate_phone('abc')
        assert err is not None


class TestUrlValidation:
    def test_valid_url(self):
        url, err = validate_url('https://example.com')
        assert err is None

    def test_no_protocol(self):
        url, err = validate_url('example.com')
        assert err is not None

    def test_empty_url_is_ok(self):
        url, err = validate_url('')
        assert err is None


class TestDateOfBirth:
    def test_valid_dob(self):
        dob, err = validate_date_of_birth('2000-06-15')
        assert dob is not None
        assert err is None

    def test_future_dob(self):
        dob, err = validate_date_of_birth('2099-01-01')
        assert err is not None

    def test_invalid_format(self):
        dob, err = validate_date_of_birth('not-a-date')
        assert err is not None
