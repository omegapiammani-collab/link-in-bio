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

## Isolated recovery rehearsal (no Supabase data) — 3 November 2026
- [x] Added `scripts/offline_restore_drill.sh` and a dedicated `offline-restore-drill` GitHub Actions job with an isolated PostgreSQL 17 service.
- [x] The job creates a disposable fixture database, a sample Link-in-Bio page record and nested sample media bytes, exports a custom-format dump and SHA-256 manifest, validates both, creates a GPG AES-256 encrypted archive, deletes the original plaintext staging directory, decrypts to an isolated directory and restores the database into a **second, separate** PostgreSQL 17 database.
- [x] It checks the restored database row exactly matches the original fixture and compares the restored media bytes to the original. GitHub Actions run #95 reported `offline-restore-drill` success.
- [ ] **This is an offline simulated restore, not a real Supabase restore.** A production-like restore of an actual encrypted archive including Supabase Auth/Storage schemas and actual file bytes is still pending.
- [ ] The `backup-manual.yml` workflow remains manual and disabled until protected credentials and off-site retention are configured.
- [ ] Full disaster recovery must also test application RLS, OAuth reconfiguration, Storage APIs and file-byte re-import into an isolated target before Phase 1 can be signed off.

## Verified feature-branch-only trigger (3 November 2026)

**No default-branch merge required for the branch-scoped `push` trigger.** GitHub still requires a workflow file on the default branch for the `workflow_dispatch` button, but a separately scoped `push` event works on `feature/phase-1-foundation`.

The staged workflow `.github/workflows/backup-manual.yml` now accepts pushes that change **only** its trigger path `ops/backup-request.txt` on the exact Phase 1 feature branch. The request has one `mode=` line:
- `mode=preflight` — checks the branch, scripts, migrations and toolchain without injecting or reading protected GitHub backup secrets. The real backup job is intentionally **skipped**.
- `mode=live` — explicitly requests the encrypted backup job **after preflight**. This has **not** been requested or run and must not be triggered until the credential names, artifact destination permissions/retention, database connection and isolated recovery plan are confirmed.

**Observed evidence:** GitHub Actions run #41644690880, commit `1aa3dadd1b372bd22ff17870467daa146d450c30`, completed successfully. The `preflight` job passed and the `backup` job was skipped, so **no real project data, credentials or Storage media were read**.

The trigger-file workflow was added and executed entirely on the feature branch; `main` and the Draft PR status were not changed. Changing other files, including tests and documentation, cannot trigger a backup run through this branch-scoped request path. The backup job remains untested with live credentials. Secret values are never to be committed, logged, or pasted into chat.

### Next safety gates
1. Independently confirm the presence (names only) of all three GitHub repository Actions Secrets.
2. Verify the configured PostgreSQL Session Pooler URL works with read-only `pg_dump`, and confirm the legacy `service_role` key is compatible with the Storage API script, without printing either credential.
3. Review the elevated service-role key scope, GitHub artifact ACL/retention and the policy for recovering the encryption passphrase.
4. Only after those checks, request one `mode=live` run with a fresh request ID, verify an encrypted artifact exists, and rehearse decryption/restore **off the live Supabase project**.
5. Confirm real non-Owner Google login denial independently. None of the steps above requires merging the Draft PR or enabling paid tiers.

## GitHub Secrets and Supabase read-only connection acceptance — 3 November 2026
- [x] GitHub Actions run **#41645648760**: `secret-readiness` succeeded; all three required secret values were present and the recovery passphrase length requirement passed. Values were not displayed or copied into repository code.
- [x] GitHub Actions run **#41645894735**: `connection-readiness` succeeded; a PostgreSQL 17 **schema-only** export of `public` completed and the Supabase private Storage bucket list API returned valid JSON. No database data was dumped, no Storage bytes downloaded, and the `backup` job was skipped.
- [x] Repository visibility was verified as **public**. GitHub Actions artifacts in a public repository are accessible to readers of that repository. The previous workflow would have created an encrypted database archive in that publicly readable artifact store.
- [x] Added fail-closed security gate: `mode=live` is denied while the repository is public, both in preflight and in the backup job condition. No actual database backup was initiated.
- [ ] Before a real encrypted backup, establish a **private** destination with adequate retention, recovery-key custody and available free quota. A separate private GitHub backup repository is a possible free-tier option, but requires a secure authorization/credential strategy and tested cross-repository artifact upload. Do not make the existing public source repository private or merge to main without user authorization.
- [ ] Recover the real archive into a separate Supabase-compatible environment; only then record a verified manifest. Real non-Owner Google login remains a distinct Phase 1 acceptance test.

Source: GitHub REST API artifacts documentation https://docs.github.com/en/rest/actions/artifacts
