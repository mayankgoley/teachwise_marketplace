#!/usr/bin/env bash
# Initialise the local MinIO bucket for TeachWise assignment uploads.
#
# Usage:
#   docker compose up -d minio
#   ./scripts/init_minio.sh
#
# Idempotent, safe to re-run. CORS is configured at container level via
# MINIO_API_CORS_ALLOW_ORIGIN in docker-compose.yml, so this script only
# needs to ensure the bucket exists.

set -euo pipefail

ENDPOINT="${R2_ENDPOINT_URL:-http://localhost:9000}"
ACCESS_KEY="${R2_ACCESS_KEY_ID:-minioadmin}"
SECRET_KEY="${R2_SECRET_ACCESS_KEY:-minioadmin}"
BUCKET="${R2_BUCKET_NAME:-teachwise-docs}"

# Source .env so the script matches what Flask sees.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^R2_' .env | sed 's/^/export /')
  set +a
  ENDPOINT="${R2_ENDPOINT_URL:-$ENDPOINT}"
  ACCESS_KEY="${R2_ACCESS_KEY_ID:-$ACCESS_KEY}"
  SECRET_KEY="${R2_SECRET_ACCESS_KEY:-$SECRET_KEY}"
  BUCKET="${R2_BUCKET_NAME:-$BUCKET}"
fi

echo "↻ Waiting for MinIO at ${ENDPOINT} ..."
for _ in {1..30}; do
  if curl -sf "${ENDPOINT}/minio/health/live" >/dev/null 2>&1; then
    echo "✓ MinIO reachable"
    break
  fi
  sleep 1
done

if ! curl -sf "${ENDPOINT}/minio/health/live" >/dev/null 2>&1; then
  echo "✗ MinIO did not become ready. Is the container up?" >&2
  echo "  Try: docker compose up -d minio" >&2
  exit 1
fi

echo "↻ Ensuring bucket ${BUCKET} via boto3"
ENDPOINT="$ENDPOINT" ACCESS_KEY="$ACCESS_KEY" SECRET_KEY="$SECRET_KEY" \
  BUCKET="$BUCKET" python3 <<'PYEOF'
import os
import sys
import boto3
from botocore.config import Config as BC
from botocore.exceptions import ClientError

c = boto3.client(
    's3',
    endpoint_url=os.environ['ENDPOINT'],
    aws_access_key_id=os.environ['ACCESS_KEY'],
    aws_secret_access_key=os.environ['SECRET_KEY'],
    region_name='auto',
    config=BC(s3={'addressing_style': 'path'}, signature_version='s3v4'),
)
bucket = os.environ['BUCKET']
try:
    c.head_bucket(Bucket=bucket)
    print(f'✓ Bucket {bucket} already exists')
except ClientError as e:
    code = e.response.get('Error', {}).get('Code', '')
    if code in ('404', 'NoSuchBucket'):
        c.create_bucket(Bucket=bucket)
        print(f'✓ Bucket {bucket} created')
    else:
        print(f'✗ Unexpected error checking bucket: {e}', file=sys.stderr)
        sys.exit(1)
PYEOF

echo ""
echo "✓ MinIO ready"
echo "  Console:  http://localhost:9001  (login: ${ACCESS_KEY} / ${SECRET_KEY})"
echo "  S3 API:   ${ENDPOINT}"
echo "  Bucket:   ${BUCKET}"
echo ""
echo "  CORS allowlist (set on container, see docker-compose.yml):"
echo "    http://localhost:3000, http://localhost:3001"
