"""
Seed script to populate test data for TeachWise.
Run once: venv/bin/python seed_test_data.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import app
from database import db
from werkzeug.security import generate_password_hash
from datetime import date, time, timedelta, datetime


def seed():
    with app.app_context():
        from models.tutor import Tutor
        from models.student import Student
        from models.guardian import Guardian
        from models.slots import TutorSlot

        PASSWORD = generate_password_hash('TestPass123!@#')

        tutor = Tutor.query.filter_by(email='testtutor@test.com').first()
        if tutor:
            tutor.address = 'Fullerton, CA'
            tutor.latitude = 33.8703
            tutor.longitude = -117.9242
            tutor.city = 'Fullerton'
            tutor.hourly_rate = 25.0
            tutor.teaching_mode = 'online'
            tutor.bio = ('Experienced coding tutor specializing in Python, '
                         'JavaScript, and web development. 2 years of '
                         'teaching experience with proven student results.')
            tutor.qualification = 'B.S. Computer Science'
            tutor.institution = 'Cal State Fullerton'
            tutor.weekly_availability_template = {
                'monday': [
                    {'start': '09:00', 'end': '10:00', 'mode': 'online',
                     'subject': 'Coding', 'price': 25.0},
                    {'start': '14:00', 'end': '15:00', 'mode': 'online',
                     'subject': 'Coding', 'price': 25.0}
                ],
                'tuesday': [
                    {'start': '09:00', 'end': '10:00', 'mode': 'online',
                     'subject': 'Coding', 'price': 25.0},
                    {'start': '14:00', 'end': '15:00', 'mode': 'online',
                     'subject': 'Coding', 'price': 25.0}
                ],
                'wednesday': [
                    {'start': '09:00', 'end': '10:00', 'mode': 'online',
                     'subject': 'Coding', 'price': 25.0},
                    {'start': '14:00', 'end': '15:00', 'mode': 'online',
                     'subject': 'Coding', 'price': 25.0}
                ],
                'thursday': [
                    {'start': '09:00', 'end': '10:00', 'mode': 'online',
                     'subject': 'Coding', 'price': 25.0},
                    {'start': '14:00', 'end': '15:00', 'mode': 'online',
                     'subject': 'Coding', 'price': 25.0}
                ],
                'friday': [
                    {'start': '09:00', 'end': '10:00', 'mode': 'online',
                     'subject': 'Coding', 'price': 25.0},
                    {'start': '14:00', 'end': '15:00', 'mode': 'online',
                     'subject': 'Coding', 'price': 25.0}
                ]
            }
            print(f'  Updated tutor: {tutor.email} (location + bio + template)')
        else:
            print('  WARNING: Test tutor not found!')

        if tutor:
            today = date.today()
            slots_created = 0
            for day_offset in range(14):
                slot_date = today + timedelta(days=day_offset + 1)
                # Skip weekends
                if slot_date.weekday() >= 5:
                    continue
                for start_h, end_h in [(9, 10), (14, 15)]:
                    existing = TutorSlot.query.filter_by(
                        tutor_id=tutor.id, date=slot_date,
                        start_time=time(start_h, 0)
                    ).first()
                    if not existing:
                        slot = TutorSlot(
                            tutor_id=tutor.id,
                            date=slot_date,
                            start_time=time(start_h, 0),
                            end_time=time(end_h, 0),
                            mode='online',
                            subject='Coding',
                            price=25.0,
                            status='pending'
                        )
                        db.session.add(slot)
                        slots_created += 1
            print(f'  Created {slots_created} open slots for test tutor')

        guardian = Guardian.query.filter_by(email='guardian@test.com').first()
        if not guardian:
            guardian = Guardian(
                name='Test Guardian',
                email='guardian@test.com',
                relationship='parent',
                is_verified=True,
                verified_on=datetime.utcnow()
            )
            guardian.password_hash = PASSWORD
            db.session.add(guardian)
            db.session.flush()
            print(f'  Created guardian: guardian@test.com')
        else:
            guardian.password_hash = PASSWORD
            guardian.is_verified = True
            print(f'  Guardian already exists: guardian@test.com (password reset)')

        minor = Student.query.filter_by(email='minorstudent@test.com').first()
        if not minor:
            minor_dob = date.today() - timedelta(days=15 * 365)  # 15 years old
            minor = Student(
                name='Minor Student',
                email='minorstudent@test.com',
                password=PASSWORD,
                date_of_birth=minor_dob,
                email_verified=True,
                guardian_id=guardian.id
            )
            db.session.add(minor)
            print(f'  Created minor student: minorstudent@test.com (age ~15, '
                  f'linked to guardian)')
        else:
            minor.password = PASSWORD
            minor.guardian_id = guardian.id
            minor.email_verified = True
            print(f'  Minor student already exists: minorstudent@test.com '
                  f'(password reset)')

        db.session.commit()
        print('\nSeed complete!')


if __name__ == '__main__':
    print('Seeding TeachWise test data...\n')
    seed()
