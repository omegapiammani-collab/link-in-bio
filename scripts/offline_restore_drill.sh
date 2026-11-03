#!/usr/bin/env bash
# Self-contained fixture-based disaster-recovery rehearsal. This script NEVER
# connects to Supabase and NEVER uses live credentials or files.
set -euo pipefail
umask 077
root="$(pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# The local Postgres 17 service is provided by the GitHub Actions job.
pg=(docker run --rm --network host -e PGPASSWORD=ci-only-local-password postgres:17)
"${pg[@]}" pg_isready -h 127.0.0.1 -U postgres -d postgres
"${pg[@]}" psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c 'CREATE DATABASE phase1_fixture_source'
"${pg[@]}" psql -h 127.0.0.1 -U postgres -d phase1_fixture_source -v ON_ERROR_STOP=1 \
  -c "CREATE TABLE public.fixture_pages (slug text PRIMARY KEY, title text NOT NULL); INSERT INTO public.fixture_pages VALUES ('fixture-page', 'Backup restore test');"

mkdir -p "$work/backup/media/nested"
printf 'link-in-bio-fixture-image-bytes' > "$work/backup/media/nested/fixture.png"
cp -R "$root/supabase/migrations" "$work/backup/schema-migrations"
WORK="$work" python3 - <<'PY'
import hashlib, json, os
from pathlib import Path
root = Path(os.environ["WORK"])
data = (root / "backup/media/nested/fixture.png").read_bytes()
(root / "backup/media-manifest.json").write_text(json.dumps([{
    "path": "nested/fixture.png",
    "bytes": len(data),
    "sha256": hashlib.sha256(data).hexdigest(),
}]))
PY

# Use the exact PostgreSQL 17 archive tools used by the manual backup workflow.
docker run --rm --network host -e PGPASSWORD=ci-only-local-password \
  -v "$work/backup:/work" postgres:17 pg_dump \
  -h 127.0.0.1 -U postgres -d phase1_fixture_source \
  --format=custom --no-owner --no-acl --schema=public \
  --file=/work/database.dump
docker run --rm -v "$work/backup:/work:ro" postgres:17 \
  pg_restore --list /work/database.dump >/dev/null
BACKUP_DIR="$work/backup" python3 "$root/scripts/verify_backup.py"

tar czf "$work/archive.tar.gz" -C "$work/backup" .
# This is an explicitly non-secret fixture passphrase.
password='ci-only-not-a-real-backup-secret'
gpg --batch --yes --pinentry-mode loopback --symmetric \
  --cipher-algo AES256 --s2k-digest-algo SHA256 --s2k-mode 3 \
  --passphrase "$password" --output "$work/archive.tar.gz.gpg" \
  "$work/archive.tar.gz"
rm -rf "$work/backup" "$work/archive.tar.gz"
mkdir -p "$work/restored"
gpg --batch --yes --pinentry-mode loopback --decrypt \
  --passphrase "$password" --output "$work/restored.tar.gz" \
  "$work/archive.tar.gz.gpg"
tar xzf "$work/restored.tar.gz" -C "$work/restored"
BACKUP_DIR="$work/restored" python3 "$root/scripts/verify_backup.py"

"${pg[@]}" psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c 'CREATE DATABASE phase1_fixture_restored'
docker run --rm --network host -e PGPASSWORD=ci-only-local-password \
  -v "$work/restored:/work:ro" postgres:17 pg_restore \
  -h 127.0.0.1 -U postgres -d phase1_fixture_restored \
  --exit-on-error --no-owner --no-acl /work/database.dump

count=$("${pg[@]}" psql -h 127.0.0.1 -U postgres \
  -d phase1_fixture_restored -At -v ON_ERROR_STOP=1 \
  -c "SELECT count(*) FROM public.fixture_pages WHERE slug='fixture-page' AND title='Backup restore test'")
test "$count" = '1'
cmp <(printf 'link-in-bio-fixture-image-bytes') \
  "$work/restored/media/nested/fixture.png"
printf '%s\n' 'Offline encrypted PostgreSQL+media fixture restore drill PASSED (no live project touched)'
