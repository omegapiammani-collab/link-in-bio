# Phase 1 — Foundation & Security (3 November 2026)

## Verified
- Next.js 16 / TypeScript / Tailwind app in `feature/phase-1-foundation`, Draft PR #1. Project remains test-only; main branch has not been merged.
- GitHub CI tested typecheck, lint, domain tests, Next.js build and **vinext/Cloudflare production build**. Confirm newest workflow run after future commits.
- Cloudflare Workers Free preview deployed to `https://link-in-bio-preview.omega-piammani.workers.dev`. Build is sourced from feature branch; do not confuse this with a production release.
- Google OAuth login created one Supabase Auth Google identity. Owner successfully accessed protected Admin page. User confirmed logout revoked Admin access until signing in again.
- Anonymous browser attempting `/admin` was redirected to Login, and malformed OAuth callback was handled without exposing Admin data.
- Single Owner mapped in `public.owner_config`, with corresponding server-only Cloudflare `OWNER_AUTH_USER_ID` binding.
- Supabase 9 public app tables have RLS; transaction-based Owner/non-Owner read/write test passed, and test data was rolled back.
- Database migrations `initial_link_in_bio_schema`, `restrict_rls_event_helper_execute`, `foreign_key_indexes`, and `harden_publishing_audit_and_media` have been applied. All four missing foreign-key indexes were corrected.
- `page_versions`, `audit_events`, `backup_manifests` are authenticated Owner **read-only** until safe trusted-server writers are implemented. This intentionally blocks publishing and audit history mutation for now.
- Supabase Storage private bucket `link-in-bio-media` created with Owner-only RLS, 5 MiB per file and JPEG/PNG/WebP/GIF allowlist. No media uploaded yet.
- No paid plan/usage was enabled as part of Phase 1.

## Pending acceptance / release gates
1. **Google-only auth configuration:** inspect and disable unused email/password provider in Supabase dashboard if enabled. Supabase Security Advisor currently warns that leaked-password checks are disabled; official docs say this feature requires Pro, so do not upgrade to fix the warning. The sole current OAuth user has no password.
2. **Real Storage tests:** upload a safe sample file as Owner; test non-Owner/anonymous denial and signed-URL access in isolated sessions, and verify delete/retention behavior.
3. **Rate limiting, trusted publishing, audit and version controls:** no direct authenticated client mutation of immutable snapshots/audit logs; implement safe server-side publish transaction and scheduled operations in Phase 2.
4. **Backup and recovery:** weekly encrypted off-Supabase copies of database **and media bytes**, retain four sets and restore-test at least one. See `docs/BACKUP_AND_RESTORE_FREE.md`. No scheduled backup or restore verification exists yet.
5. **Non-Owner Google account test:** a separate real account/session must be denied Admin, in addition to passing RLS simulations.
6. Confirm GitHub CI and Cloudflare build for the newest commit before merging; ensure no secrets were committed and Workers Free remains the active plan.
7. Phase 2 public renderer, content blocks, scheduling, publish/rollback, and ten-page load tests are **not** present in this foundation milestone.

## Security requirements
- Never commit or send OAuth Client Secret, service-role key, DB password or backup encryption key through chat, GitHub source, or client JS.
- Private Draft and historical Version tables are never anonymous-readable. Public pages must use a deliberately restricted renderer / API.
- Publishing and audit rows are locked against direct client writes until appropriate reviewed server workflows exist.
- No Supabase Storage public bucket. Serve public media later via narrowly scoped methods only.
- No paid Supabase, Cloudflare or GitHub upgrades without user approval.

## What has NOT been claimed
- The Supabase Security Advisor still has a password-protection warning (not a missing-RLS warning).
- The project does not yet have verified encrypted backups.
- Real non-Owner Google sessions and media file operations have not been end-to-end tested.
- Production is not launched and Phase 1 remains open pending hardening and recovery acceptance.
