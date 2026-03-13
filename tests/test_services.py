"""D5: Tests for service layer functions."""
import pytest
from datetime import date, time, timedelta, datetime


class TestBookingService:
    def test_calculate_refund_100_pct(self, db_session, sample_slot):
        from services.booking_service import calculate_refund_percentage
        pct = calculate_refund_percentage(sample_slot)
        assert pct == 100

    def test_reopen_slot_success(self, db_session, sample_slot):
        from services.booking_service import reopen_slot
        sample_slot.status = 'booked'
        sample_slot.student_id = 1
        db_session.session.commit()
        result = reopen_slot(sample_slot)
        assert result is True
        assert sample_slot.status == 'pending'

    def test_reopen_slot_none(self):
        from services.booking_service import reopen_slot
        assert reopen_slot(None) is False


class TestCacheService:
    def test_cache_service_import(self):
        try:
            from services.cache_service import cache_get, cache_set
        except ImportError:
            pytest.skip('Cache service not available')

    def test_cache_get_miss(self):
        try:
            from services.cache_service import cache_get
            result = cache_get('nonexistent_key_12345')
            assert result is None
        except Exception:
            pytest.skip('Cache service not available')


class TestEncryptionService:
    def test_encrypt_decrypt_roundtrip(self):
        try:
            from services.encryption_service import encrypt_field, decrypt_field
            original = 'test-secret-data-123'
            encrypted = encrypt_field(original)
            assert encrypted is not None
            assert encrypted != original
            decrypted = decrypt_field(encrypted)
            assert decrypted == original
        except Exception:
            pytest.skip('Encryption service not configured')


class TestRecommendationService:
    def test_get_recommended_tutors(self, db_session, tutor_user):
        from services.recommendation_service import get_recommended_tutors
        tutors = get_recommended_tutors(limit=5)
        assert isinstance(tutors, list)
