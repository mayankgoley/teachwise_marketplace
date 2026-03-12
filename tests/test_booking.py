"""Tests for the booking service."""
import pytest
from datetime import date, time, timedelta, datetime
from services.booking_service import (
    calculate_refund_percentage, reopen_slot, cancel_booking,
)


class TestRefundCalculation:
    def test_full_refund_over_24h(self, db_session, sample_slot):
        # Slot is 2 days away
        pct = calculate_refund_percentage(sample_slot)
        assert pct == 100

    def test_no_refund_under_12h(self, db_session, tutor_user):
        from models.slots import TutorSlot
        soon = datetime.utcnow() + timedelta(hours=6)
        slot = TutorSlot(
            tutor_id=tutor_user.id,
            date=soon.date(),
            start_time=soon.time(),
            end_time=(soon + timedelta(hours=1)).time(),
            mode='online', price=25.0, status='booked',
        )
        db_session.session.add(slot)
        db_session.session.commit()
        pct = calculate_refund_percentage(slot)
        assert pct == 0

    def test_half_refund_12_to_24h(self, db_session, tutor_user):
        from models.slots import TutorSlot
        future = datetime.utcnow() + timedelta(hours=18)
        slot = TutorSlot(
            tutor_id=tutor_user.id,
            date=future.date(),
            start_time=future.time(),
            end_time=(future + timedelta(hours=1)).time(),
            mode='online', price=25.0, status='booked',
        )
        db_session.session.add(slot)
        db_session.session.commit()
        pct = calculate_refund_percentage(slot)
        assert pct == 50


class TestReopenSlot:
    def test_reopen_individual_slot(self, db_session, sample_slot):
        sample_slot.status = 'booked'
        sample_slot.student_id = 1
        db_session.session.commit()

        result = reopen_slot(sample_slot)
        assert result is True
        assert sample_slot.status == 'pending'
        assert sample_slot.student_id is None

    def test_reopen_group_slot(self, db_session, tutor_user):
        from models.slots import TutorSlot
        slot = TutorSlot(
            tutor_id=tutor_user.id,
            date=date.today() + timedelta(days=3),
            start_time=time(14, 0),
            end_time=time(15, 0),
            is_group=True, max_students=5,
            current_students=5, status='booked',
            mode='online', price=15.0,
        )
        db_session.session.add(slot)
        db_session.session.commit()

        reopen_slot(slot)
        assert slot.current_students == 4
        assert slot.status == 'pending'

    def test_reopen_none_slot(self):
        assert reopen_slot(None) is False


class TestCancelBooking:
    def test_student_cancel(self, db_session, booked_slot, sample_slot):
        result = cancel_booking(booked_slot, 'student', slot=sample_slot)
        assert booked_slot.status == 'Cancelled'
        assert booked_slot.cancelled_by == 'student'
        assert result['refund_pct'] == 100  # slot is >24h away
        assert sample_slot.status == 'pending'

    def test_tutor_cancel_full_refund(self, db_session, booked_slot, sample_slot):
        result = cancel_booking(booked_slot, 'tutor', refund_pct=100, slot=sample_slot)
        assert booked_slot.status == 'Cancelled'
        assert booked_slot.cancelled_by == 'tutor'
        assert result['refund_pct'] == 100
