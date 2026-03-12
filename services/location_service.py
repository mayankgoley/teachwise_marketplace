from database import db
from models.tutor import Tutor
from sqlalchemy import func

EARTH_RADIUS_KM = 6371


def find_nearby_tutors(lat, lng, radius_km=25, subject=None, limit=50):
    haversine = (
        EARTH_RADIUS_KM * func.acos(
            func.least(1.0,  # Clamp to prevent acos domain error
                func.cos(func.radians(lat))
                * func.cos(func.radians(Tutor.latitude))
                * func.cos(func.radians(Tutor.longitude) - func.radians(lng))
                + func.sin(func.radians(lat))
                * func.sin(func.radians(Tutor.latitude))
            )
        )
    )

    query = db.session.query(
        Tutor,
        haversine.label('distance_km')
    ).filter(
        Tutor.verification_status == 'verified',
        Tutor.latitude.isnot(None),
        Tutor.longitude.isnot(None),
    )

    if subject:
        query = query.filter(
            Tutor.subject.ilike(f'%{subject}%')
        )

    query = query.having(
        haversine <= radius_km
    ).order_by(
        haversine.asc()
    ).limit(limit)

    results = query.all()

    return [
        {
            'tutor': row[0],
            'distance_km': round(row[1], 1)
        }
        for row in results
    ]


def get_tutor_location_data(tutors_with_distance):
    return [
        {
            'id': item['tutor'].id,
            'name': item['tutor'].name,
            'subject': item['tutor'].subject,
            'rating': item['tutor'].rating_avg or item['tutor'].average_rating or 0,
            'experience': item['tutor'].experience or 0,
            'hourly_rate': item['tutor'].hourly_rate or 0,
            'city': item['tutor'].city or '',
            'lat': item['tutor'].latitude,
            'lng': item['tutor'].longitude,
            'distance_km': item['distance_km'],
            'profile_url': f'/tutor/{item["tutor"].id}',
        }
        for item in tutors_with_distance
    ]
