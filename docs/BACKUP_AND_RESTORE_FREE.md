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
