# backfill_geocode.py — Run once with: python backfill_geocode.py
# Geocodes all tutors that have an address but no lat/lng yet.

from app import app, db
from models.tutor import Tutor
from services.geocoding_service import geocode_and_save

with app.app_context():
    tutors = Tutor.query.filter(
        Tutor.address.isnot(None),
        Tutor.latitude.is_(None)
    ).all()
    print(f'Found {len(tutors)} tutors to geocode')
    for t in tutors:
        if geocode_and_save(t, t.address):
            print(f'  {t.name}: {t.city} ({t.latitude}, {t.longitude})')
        else:
            print(f'  {t.name}: FAILED')
    db.session.commit()
    print('Done!')
