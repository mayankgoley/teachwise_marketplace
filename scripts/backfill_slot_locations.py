"""
Backfill existing offline tutor_slots with their tutor's profile location.
Run: flask --app app shell < scripts/backfill_slot_locations.py
Or:  python scripts/backfill_slot_locations.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db
from models.tutor import Tutor
from models.slots import TutorSlot


def backfill():
    with app.app_context():
        tutors = Tutor.query.filter(
            Tutor.latitude.isnot(None),
            Tutor.longitude.isnot(None)
        ).all()

        updated = 0
        for tutor in tutors:
            slots = TutorSlot.query.filter(
                TutorSlot.tutor_id == tutor.id,
                TutorSlot.mode.in_(['in-person', 'both']),
                TutorSlot.location_latitude.is_(None)
            ).all()

            for slot in slots:
                slot.location_latitude = tutor.latitude
                slot.location_longitude = tutor.longitude
                slot.location_address = tutor.address
                slot.radius_miles = tutor.default_radius_miles or 10.0
                slot.location_is_default = True
                slot.radius_is_default = True
                updated += 1

        db.session.commit()
        print(f'Backfilled {updated} slots from {len(tutors)} tutors.')


if __name__ == '__main__':
    backfill()
