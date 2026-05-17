"""F33b end-to-end smoke test.

Round-trip: log in as a student, presign + PUT a PDF to MinIO via the
returned URL, attach it server-side, then log in as a tutor and download
the same file via the presigned GET URL. Verifies the object also exists
in MinIO directly.

Run:
  python scripts/smoke_f33b_presigned.py

Assumes:
  - Flask running on http://localhost:5001
  - MinIO running on http://localhost:9000 with bucket `teachwise-docs`
  - .env points R2_* to MinIO
"""
import sys
import json
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import requests

API = 'http://localhost:5001'
STUDENT_EMAIL = 'smoke_student@test.com'
TUTOR_EMAIL = 'smoke_tutor@test.com'
PASSWORD = 'SmokePw1!@#'

PDF_BYTES = (
    b'%PDF-1.4\n'
    b'1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
    b'2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\n'
    b'xref\n0 3\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n'
    b'trailer<</Size 3/Root 1 0 R>>\nstartxref\n110\n%%EOF\n'
)


def step(msg):
    print(f'\n→ {msg}')


def fail(msg):
    print(f'✗ {msg}', file=sys.stderr)
    sys.exit(1)


def seed_users_and_assignment():
    """Create the test student, tutor, and an assignment between them."""
    from app import app
    from database import db
    from models.student import Student
    from models.tutor import Tutor
    from models.assignment import Assignment
    from werkzeug.security import generate_password_hash

    with app.app_context():
        student = Student.query.filter_by(email=STUDENT_EMAIL).first()
        if not student:
            student = Student(
                name='Smoke Student',
                email=STUDENT_EMAIL,
                password=generate_password_hash(PASSWORD),
                date_of_birth=date(2000, 1, 1),
                email_verified=True,
            )
            db.session.add(student)

        tutor = Tutor.query.filter_by(email=TUTOR_EMAIL).first()
        if not tutor:
            tutor = Tutor(
                name='Smoke Tutor',
                email=TUTOR_EMAIL,
                password=generate_password_hash(PASSWORD),
                subject='Math',
                verification_status='verified',
                is_profile_complete=True,
            )
            db.session.add(tutor)
        db.session.commit()

        assignment = Assignment.query.filter_by(
            tutor_id=tutor.id, student_id=student.id,
            title='Smoke F33b Upload Test',
        ).first()
        if not assignment:
            assignment = Assignment(
                tutor_id=tutor.id,
                student_id=student.id,
                title='Smoke F33b Upload Test',
                description='Programmatic test for the presigned PUT flow.',
                subject='Math',
                due_date=datetime.utcnow() + timedelta(days=3),
                status='assigned',
            )
            db.session.add(assignment)
            db.session.commit()

        return {
            'student_id': student.id,
            'tutor_id': tutor.id,
            'assignment_id': assignment.id,
        }


def login(session, role, email):
    r = session.post(
        f'{API}/api/v1/{role}/login',
        json={'email': email, 'password': PASSWORD},
        allow_redirects=False,
    )
    if r.status_code not in (200, 302):
        fail(f'Login {role} {email} → HTTP {r.status_code}: {r.text[:200]}')
    return r


def main():
    step('Seeding student, tutor, and an assignment in the dev DB')
    ids = seed_users_and_assignment()
    print(json.dumps(ids, indent=2))

    s_session = requests.Session()
    t_session = requests.Session()

    step(f'Logging in as student ({STUDENT_EMAIL})')
    login(s_session, 'student', STUDENT_EMAIL)
    me = s_session.get(f'{API}/api/v1/auth/me')
    if me.status_code != 200:
        fail(f'/auth/me as student → {me.status_code}: {me.text[:200]}')
    print(f'  ✓ session OK ({me.json()["data"].get("name", "?")})')

    step('Requesting presigned PUT URL')
    presign = s_session.post(
        f'{API}/api/v1/assignments/{ids["assignment_id"]}/upload-url',
        json={
            'file_name': 'smoke.pdf',
            'content_type': 'application/pdf',
            'size_bytes': len(PDF_BYTES),
        },
    )
    if presign.status_code != 200:
        fail(f'/upload-url → {presign.status_code}: {presign.text[:300]}')
    pdata = presign.json()['data']
    print(f'  ✓ object_key={pdata["object_key"]}')
    print(f'  ✓ upload_url={"<set>" if pdata["upload_url"] else "<null>"}')
    if not pdata['upload_url']:
        fail('upload_url is null. Server is in local-storage mode.\n'
             '  Check R2_* env vars in .env (must point to MinIO/R2).')

    step('PUT bytes directly to MinIO')
    put = requests.put(
        pdata['upload_url'],
        data=PDF_BYTES,
        headers={'Content-Type': 'application/pdf'},
    )
    if put.status_code not in (200, 204):
        fail(f'PUT to MinIO → {put.status_code}: {put.text[:300]}')
    print(f'  ✓ HTTP {put.status_code}, ETag={put.headers.get("ETag")}')

    step('Attaching uploaded file to the assignment server-side')
    attach = s_session.post(
        f'{API}/api/v1/assignments/{ids["assignment_id"]}/attach',
        json={
            'object_key': pdata['object_key'],
            'file_name': 'smoke.pdf',
            'content_type': 'application/pdf',
            'size_bytes': len(PDF_BYTES),
        },
    )
    if attach.status_code not in (200, 201):
        fail(f'/attach → {attach.status_code}: {attach.text[:300]}')
    adata = attach.json()['data']
    print(f'  ✓ attached_to={adata["attached_to"]}')
    print(f'  ✓ file metadata: {json.dumps(adata["file"], indent=2)}')

    step('Verifying object exists in MinIO via direct boto3')
    import boto3
    from botocore.config import Config as BC
    c = boto3.client(
        's3',
        endpoint_url='http://localhost:9000',
        aws_access_key_id='minioadmin',
        aws_secret_access_key='minioadmin',
        region_name='auto',
        config=BC(s3={'addressing_style': 'path'}, signature_version='s3v4'),
    )
    head = c.head_object(Bucket='teachwise-docs', Key=pdata['object_key'])
    print(f'  ✓ MinIO HEAD: size={head["ContentLength"]} '
          f'content-type={head["ContentType"]}')

    step(f'Logging in as tutor ({TUTOR_EMAIL})')
    login(t_session, 'tutor', TUTOR_EMAIL)
    tme = t_session.get(f'{API}/api/v1/auth/me')
    if tme.status_code != 200:
        fail(f'/auth/me as tutor → {tme.status_code}')
    print(f'  ✓ session OK ({tme.json()["data"].get("name", "?")})')

    step('Requesting presigned GET (download) URL as tutor')
    dl = t_session.post(
        f'{API}/api/v1/assignments/files/download-url',
        json={'object_key': pdata['object_key'], 'file_name': 'smoke.pdf'},
    )
    if dl.status_code != 200:
        fail(f'/download-url → {dl.status_code}: {dl.text[:300]}')
    download_url = dl.json()['data']['download_url']
    print(f'  ✓ download_url=<set>, expires_in={dl.json()["data"]["expires_in"]}s')

    step('Downloading bytes from MinIO with the presigned GET')
    got = requests.get(download_url)
    if got.status_code != 200:
        fail(f'GET to MinIO → {got.status_code}: {got.text[:300]}')
    if got.content != PDF_BYTES:
        fail(f'Downloaded bytes differ ({len(got.content)} vs '
             f'{len(PDF_BYTES)})')
    print(f'  ✓ downloaded {len(got.content)} bytes, matches source')

    step('SMOKE TEST PASSED ✓')
    print(f'  Object key:   {pdata["object_key"]}')
    print(f'  Visible in:   http://localhost:9001 → teachwise-docs')
    print(f'  Assignment:   /api/v1/student/assignments/{ids["assignment_id"]}')


if __name__ == '__main__':
    main()
