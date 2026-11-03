# Phase 1: Backup and recovery on free tiers (design, NOT yet operational)

**Status:** Design documented; no off-site backup has been taken or restore-tested. Do not treat the empty `backup_manifests` table as evidence of a backup. No new paid services are permitted.

## Recovery objectives and scope
- Weekly encrypted, off-Supabase copies; retain at least **four independent weekly sets**.
- Each set includes: database **data** (public application tables plus essential Auth/Storage metadata), a full matching set of media file bytes from the private bucket `link-in-bio-media`, schema migrations, checksums, a date/time manifest, and a documented restoration order.
- Always include media bytes: Supabase logical database dumps and automatic database snapshots do **not** contain the actual Storage file bytes.
- Recovery-point objective with weekly backups: potentially up to **7 days of data loss**. Recovery-time objective remains **unverified** until restore drills.
- Keep copies encrypted and access-controlled; never commit database dumps, access keys, user emails, backups, or archive decryption keys to this public repository.

## Safe free-tier architecture proposed
1. Use the existing GitHub Free account with a **separate private backup repository** or private retained GitHub Actions artifacts, not this public repository. Confirm available free artifact quota and retention before scheduling. Do not create a paid resource.
2. GitHub Actions scheduled weekly runs, only after secrets are entered **directly in GitHub Actions secrets UI** by the Owner (never in issues, commits, logs or ChatGPT):
   - A limited PostgreSQL backup connection string (read access, no write permissions).
   - A read-only Storage object listing/download capability for the private media bucket. Never expose a service-role key in source or browser; if the only available key has elevated privileges, use a properly isolated Actions secret and limit usage.
   - A distinct high-entropy backup encryption passphrase or recipient public key; retain the restore key offline separately from GitHub.
3. Dump PostgreSQL data with a compatible client version, stream to a temporary encrypted archive, download media objects into the same encrypted backup, calculate SHA-256 checksums, and write a manifest with explicit DB and media counts.
4. Upload only the **encrypted** archive to the private off-site destination; immediately delete temporary plaintext data in the job and limit job permissions. Verify checksums after download.
5. Keep at least four completed sets in chronological order. Prune only after the fifth set has been verified, never before.
6. Restore quarterly into an **isolated disposable environment**, NEVER over the live Supabase project. Validate schema version, Owner-only RLS, content counts and sample media checksums. Record the verified manifest only after restore passes.
7. Alert on missed/failed weekly backup; a scheduled job marked `success` without an encrypted archive and checksum **is not a completed backup**.

## Prerequisites still missing (not to be bypassed)
- Secure backup credentials and encrypted off-site destination are not configured.
- No backup job has been scheduled or enabled.
- No restore test has run. The live app currently has no pages or media, so a production-like restore drill also needs representative sample data.
- Supabase Free does not include scheduled automatic database backups. See the official Supabase backups guide: https://supabase.com/docs/guides/platform/backups

## Immediate protection already applied
- Database schema migrations `0001` through `0004` are committed to the Phase 1 branch and applied to the connected project.
- `backup_manifests` is Owner-readable only; Owner clients cannot forge a `verified_at` or backup record.
- Media bucket is private with Owner-only RLS; only JPEG/PNG/WebP/GIF files up to 5 MiB are accepted.
- Data are still at risk until independent off-site copies and a successful restore test exist.

## Implemented staging workflow — 3 November 2026

- A **manual, disabled-until-configured** GitHub Actions workflow now exists at `.github/workflows/backup-manual.yml`. No schedule is enabled, and no real backup has yet been made.
- The workflow refuses to run unless three GitHub Actions repository secrets have been securely configured **in GitHub Settings only**:
  1. `BACKUP_DATABASE_URL`: trusted PostgreSQL connection URL for the managed Supabase project, ideally with restricted backup permissions.
  2. `BACKUP_STORAGE_SERVICE_ROLE_KEY`: dedicated credential for downloading the private Storage objects. This credential grants broad privileges and must never be placed in GitHub source or messages. Use only the repository's protected Actions secret store.
  3. `BACKUP_ENCRYPTION_PASSPHRASE`: a strong unique encryption passphrase of at least 24 characters; save it independently offline because the backups cannot be restored without it.
- The workflow uses a Postgres 17 client to export `public`, `auth`, and `storage` schemas and data; separately downloads **actual** private Storage file bytes, recursively and with a SHA-256 manifest.
- It wraps schema migrations, database dump, media bytes, and checksums into a symmetric AES-256 GPG archive. The job checks decryption/tar integrity before publishing only the encrypted artifact, with retention 35 days.
- A private destination and four independently verified retained sets are **not yet established**. GitHub Actions artifacts in a public repository must be treated as accessible to authorized repository collaborators and protected by encryption. Do not place unencrypted backups in artifacts.
- `scripts/backup_storage.py` includes safe nested directory handling, pagination and directory-traversal rejection. Unit tests run offline with mocked Storage API responses.
- Do not mark backup complete until a real encrypted file is downloaded, decrypted offline, checked against its manifest, and restored to an **isolated** environment. A successful workflow alone does not prove restore capability.
- `workflow_dispatch` normally requires the workflow to be present on the repository default branch. Keep it on this feature branch during review; activation requires the reviewed and approved merge in a later release step, not an automatic bypass of branch protection.
- The backup schedule is intentionally absent until initial manual backup/restore passes and free-tier storage/usage constraints are reviewed.

Note: Postgres dumps that include managed `auth` and `storage` schemas may require careful selective restore into a fresh Supabase project. Never restore them directly over an active managed project. Restoration procedures are unverified.

## Pre-encryption integrity gate — implemented and unit-tested
- The manual backup workflow now validates the PostgreSQL 17 custom dump with `pg_restore --list` in the matching PostgreSQL 17 Docker image.
- `scripts/verify_backup.py` separately checks the custom archive header, schema migration files, every media path, file size, SHA-256 hash, duplicate entries and files omitted from the media manifest before the archive is encrypted.
- Offline unit tests in `tests/test_verify_backup.py` cover valid input, tampered media, undeclared media and duplicate manifest records. All tests use mock fixtures and never connect to the live project.
- This is **archive integrity verification**, not successful restoration: the first encrypted database and media backup and isolated restore drill are still required. The manual workflow remains disabled until protected secrets are configured and the workflow is approved on the default branch.
