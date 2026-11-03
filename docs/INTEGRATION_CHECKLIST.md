# Phase 1 integration checklist — verified and remaining

## Supabase Free — verified
- [x] Connected Supabase project `mmbhuxiejfqipttyujop` (Free plan, London region).
- [x] Migration `initial_link_in_bio_schema` applied successfully.
- [x] Migration `restrict_rls_event_helper_execute` applied successfully.
- [x] All nine public base tables have RLS enabled.
- [x] Catalog privilege checks: `anon` cannot SELECT private Draft or Published Version tables.
- [x] Security Advisor has no findings after restricting the existing `rls_auto_enable()` function.
- [ ] Validate RLS with real authenticated Owner and non-Owner sessions (essential).

## Google OAuth — user reported configuration completed; live login not yet verified
- [x] User reported creating Google OAuth web client in Google Cloud Console; use the **Supabase callback URL** from the Supabase Google provider settings as an Authorized Redirect URI.
- [x] User reported entering OAuth client ID/secret in Supabase > Authentication > Providers > Google. Never paste secrets into ChatGPT or repository.
- [ ] Set Supabase Site URL and allow `http://localhost:3000/auth/callback` during local testing; later add only the exact Cloudflare preview/production origin.
- [x] Google OAuth sign-in created exactly one Supabase Auth user and Google identity on 3 November 2026.
- [x] Bootstrapped the unique Google identity as the sole `owner_config` row using privileged SQL and configured `OWNER_AUTH_USER_ID` as a Cloudflare runtime secret; UUID is not committed to Git.
- [x] Simulated authenticated Owner: `app_private.is_owner()` returns true. Simulated non-Owner: returns false.\n- [x] Owner confirmed Google OAuth callback led to `/admin`, browser sign-out removed access, and unauthenticated /admin redirect to /login was independently checked.

## Live RLS negative authorization test — verified 3 November 2026
- [x] In a transaction, simulated an `authenticated` role bearing a non-Owner UUID. `app_private.is_owner()` returned false.
- [x] SELECT queries for pages, drafts and historical versions returned no rows.
- [x] Attempted INSERT to `public.pages` was denied with SQLSTATE `42501`, 'new row violates row-level security policy'. No security-test page was created.
- [ ] Repeat Owner positive-case and OAuth browser tests with a real authenticated session.

## Cloudflare Workers Free — pending
- [x] Cloudflare connection verified and official Workers/Next.js guidance consulted.
- [ ] Test `vinext check`, Cloudflare preview deploy, Next.js SSR and Supabase cookies.
- [ ] Measure free request/CPU limits, confirm no paid overage enabled.
- [ ] Test ten pages / twenty blocks once public renderer is implemented.

## GitHub
- [x] Repository and feature branch prepared.
- [x] Draft PR #1 opened.
- [x] Initial GitHub Actions CI run #2 succeeded.
- [ ] Check most recent PR commit CI; do not merge with failing checks.

## Reminders
- Database migrations are **already applied** to the connected Supabase project. Do not blindly reapply them.
- No paid project, storage product, or deployment was enabled.
- Do not send password, access token, client secret, or service-role key in chat.

## Google Owner bootstrap verification — 3 November 2026
- One Auth user, one Google identity, exactly one owner row; positive and negative RLS simulations passed.
- Cloudflare Worker `link-in-bio-preview` deployed from the feature branch; its runtime Owner UUID is set as an encrypted secret binding.
- Next step: use the Google sign-in button again and verify the protected Admin screen in the browser. Do not call Phase 1 complete until cookie persistence and logout are tested.
- Supabase Advisor currently warns about leaked-password protection being off. This app uses Google-only login; review the setting if password sign-in is enabled.

## Post-login security test — 3 November 2026
- [x] Owner confirmed sign-in with Google leads to protected Admin dashboard.
- [x] Supabase: one Google user, one Owner and one Auth session.
- [x] Owner could insert/read a disposable page in a transaction; a different authenticated UUID could not SELECT it; rolled back and confirmed no residual test page.
- [x] All nine public tables have RLS enabled.
- [x] GitHub Actions Checks run #25 completed successfully.
- [x] Owner confirmed sign-out prevents returning to /admin until signing in again; Supabase later showed zero active sessions.
- [ ] Test /admin unauthorized in a separate browser and non-Owner Google account.
- [ ] Review Supabase password protection warning before production.\n- [x] Four missing foreign-key indexes added via migration foreign_key_indexes, verified no unindexed-FK advisories remain.

## Security and database performance acceptance — 3 November 2026
- [x] Browser Owner authenticated and signed out successfully, with protected /admin inaccessible after logout (owner confirmation).
- [x] Independent no-cookie browser test of /admin redirects to /login; /auth/callback without OAuth code safely redirects to /login?error=callback.
- [x] Supabase auth.sessions count dropped to zero after logout.
- [x] Added and applied migration `foreign_key_indexes` with 4 B-tree indexes. Supabase performance advisor no longer flags any unindexed foreign keys. The unused-index informational notices are expected on an almost-empty database; retain indexes until representative traffic exists.
- [x] GitHub checks workflow extended to validate `npm ci`, Next.js build and Cloudflare vinext build (CI result must be confirmed on latest commit).
- [ ] Investigate Supabase leaked-password-protection warning and Google-only sign-in settings.
- [ ] Non-Owner real Google-session denial remains untested; RLS negative session simulations and anonymous browser denial passed.
- [ ] Backup/export restore exercise, Supabase Storage policies, rate-limiting, audit-write and page-version publishing transaction controls are pending.

## Security hardening — 3 November 2026 (migration 0004 applied)
- [x] Applied `harden_publishing_audit_and_media` migration to the connected project and committed the exact SQL in `supabase/migrations/0004_harden_publishing_audit_and_media.sql`.
- [x] Immutable tables `page_versions` and `audit_events` are Owner-readable but authenticated clients cannot write or edit them; trusted server Publish/Audit workflows must be implemented before Phase 2 edits.
- [x] `backup_manifests` is also read-only for authenticated clients, preventing fabricated backup/restore verification evidence.
- [x] Created private `link-in-bio-media` Storage bucket, maximum 5 MiB per image, JPEG/PNG/WebP/GIF only; 4 Owner-scoped Storage RLS policies exist; zero files initially.
- [x] Supabase Security Advisor has no new database/RLS findings; the sole warning concerns leaked-password protection, which Supabase documents as Pro-only. The only existing Auth account has no password.
- [ ] Check **Supabase Auth > Providers > Email** and disable password-based sign-in if not needed, while retaining Google OAuth; this provider configuration was not modified via MCP.
- [ ] Perform actual authenticated media upload/download and anonymous/non-Owner access denial tests. Catalog/policy tests are not sufficient for full Storage acceptance.
- [ ] Create four encrypted weekly *off-Supabase* backup sets, including database records **and actual Storage file bytes**, and independently restore-test at least one set. See `docs/BACKUP_AND_RESTORE_FREE.md`. A runbook is **not** an operational backup.
- [ ] Decide on secure server-only rate limiting, audit event writers, and atomic version publication before any production launch.

## Storage RLS and backup implementation — 3 November 2026
- [x] Transaction-based Storage RLS positive test: simulated authenticated Owner can INSERT/SELECT a temporary row in `storage.objects`.
- [x] Simulated non-Owner cannot SELECT the same Storage metadata; a non-Owner INSERT was rejected with SQLSTATE `42501`.
- [x] Storage test transaction rolled back and did not create a physical object or orphaned metadata.
- [x] Implemented a manual-only, secret-gated GitHub Actions backup workflow `.github/workflows/backup-manual.yml` with Postgres 17 dump, recursive private Storage download, checksums and encrypted artifact retention. **Not configured, run or restore-tested.**
- [x] Added offline tests for Storage backup recursion and traversal validation; GitHub CI runs them without credentials.
- [x] Added Owner-only `/admin` button to exercise the actual Storage API (temporary image upload, download/byte check and delete).
- [ ] Owner must press `เริ่มทดสอบ Storage` on the refreshed Preview Admin page and report outcome. RLS tests are not substitutes for this real API test.
- [ ] Finalize encrypted backup secrets in GitHub Actions directly (do not share them in chat), run manual backup only after approved merge, download and verify encrypted archive, restore-test in isolated environment; then enable a weekly schedule if it stays within free quotas.
- [ ] Supabase dashboard Auth > Providers inspection remains pending because authenticated dashboard access was not available. Do not claim Email/Password disabled.

## Google-only provider setting — 3 November 2026
- [x] User provided Supabase Dashboard screenshots confirming Google Sign-in was enabled and Email Provider was initially enabled.
- [x] User reports switching **Email Provider off** in Supabase Auth Providers and saving.
- [x] Database rechecked after reported change: one Google identity, one Owner mapping, zero residual media files.
- [ ] Independently inspect persisted provider configuration (the connected Browser Use session has not authenticated to Supabase dashboard).
- [ ] User should sign in via Google again after switching Email Provider off, verify /admin and then log out.
- [ ] Supabase Security Advisor continues to show the Pro-only leaked-password protection warning; avoid upgrading merely to remove this warning. Since Google-only is intended, verify Email Provider remains disabled.

## Phase 1 auth regression acceptance — 3 November 2026
- [x] User confirmed Google Owner Login **and** Logout still work after disabling Email Provider in Supabase Dashboard.
- [x] The user previously supplied screenshots showing Google enabled and Email enabled, and later reported saving Email as disabled. The latest persisted provider toggle has not been independently read through an authenticated Dashboard browser session.
- [x] Post-logout database check: one Google identity, one authorized Owner, zero live Auth sessions, zero leftover Storage objects.
- [x] User confirmed real Storage API upload, download, byte verification, and deletion via Owner Admin button.
- [x] Staged encrypted-backup workflow repaired to copy schema migrations **before** pre-encryption archive integrity checks; tests now assert staging/verification/encryption order.
- [x] Large PostgreSQL dump header check now reads only 5 bytes, rather than loading the whole database.
- [ ] Manual encrypted backup run and **separate isolated restore drill** remain untested and cannot be represented as complete.
- [ ] Real non-Owner Google session and deny-access regression remain untested; no second Google account was requested or changed.
- [ ] Confirm new CI run and Cloudflare builds before merging; leave PR as Draft and keep Production disabled.

## Encrypted recovery rehearsal — 3 November 2026
- [x] Google-only Owner login/logout remained successful after the user disabled Email Provider.
- [x] Isolated local PostgreSQL 17 recovery rehearsal passed in GitHub Actions run #95: fixture table, custom-format pg_dump, nested media bytes, AES-256 encrypted archive, decryption, restore to a separate fixture database, database row equality and media-byte equality.
- [x] Test data and encryption password are **fake CI fixtures only**; no Supabase project secrets or production user records were accessed.
- [ ] Real encrypted off-Supabase backup and real recovery into an isolated Supabase-compatible environment remain outstanding. Do not count the fixture rehearsal as production backup evidence.
- [ ] Real non-Owner Google OAuth sign-in denial still outstanding; only simulated RLS denial has been independently tested.
- [ ] Re-run full CI on latest branch before merge and leave Draft PR open until the actual backup/recovery sign-off.

## Secrets setup and live-backup preflight — 3 November 2026
- [x] User confirms adding `BACKUP_DATABASE_URL`, `BACKUP_STORAGE_SERVICE_ROLE_KEY`, and `BACKUP_ENCRYPTION_PASSPHRASE` through GitHub repository Actions Secrets, and saving the recovery passphrase separately in Google Password Manager.
- [ ] Independent verification of the three **secret names** in GitHub Settings is still pending: secure Browser Use session was signed out on latest attempt. Never ask the user to paste the values.
- [x] Supabase database PostgreSQL server version 17.11 matches the workflow's PostgreSQL 17 image.
- [x] Private media bucket contains zero objects, and `backup_manifests` contains zero rows. No real backup may be marked complete from this evidence.
- [x] Added `umask 077` around Storage download and `if: always()` cleanup of plaintext staging, temporary archive, and local encrypted file in the manual backup workflow.
- [ ] **GitHub platform blocker:** `workflow_dispatch` requires the workflow file to exist on the repository's default branch. `.github/workflows/backup-manual.yml` only exists on `feature/phase-1-foundation`; therefore the manual workflow must not be represented as runnable yet. Do not merge or push to `main` without explicit user approval.
- [ ] Verify backup DATABASE URL connectivity, encrypted archive actually uploaded, archive retained outside Supabase, and restore into isolated Supabase-compatible target. No live-run has occurred.
- [ ] A separate real non-Owner Google login and unauthorized Admin access check are required before closing Phase 1.

## Additional real-backup recovery checks — 3 November 2026
- [x] Backup vaulted exclusively in Private `omegapiammani-collab/link-in-bio-backups`: Actions #41649973610, encrypted Artifact ID 13238095372, retained until 8 December 2026.
- [x] Independently downloaded, decrypted and validated the real stored artifact (checksum, media manifest and migration presence) in private Actions #41660457480.
- [x] Verified the real backup catalog includes **all nine application table definitions** and Auth/Storage table catalog entries.
- [x] Restored **two independent backed-up public tables** (`backup_manifests`, `audit_events`) in isolated PostgreSQL 17, via private Actions #41660457480. This is *limited restore evidence*, not a complete recovery.
- [ ] **Do not mark completed:** full isolated Supabase-compatible restore, including all 9 application tables, Auth/Storage metadata, RLS/roles, and actual media bytes.
- [ ] **Do not mark completed:** real Google login from a separate non-Owner account.
- [ ] Independently retain an encrypted off-GitHub copy before GitHub Artifact expiry.
- [x] Public source `main` remains unchanged; Phase 1 Draft PR remains unmerged.

## Phase 1 finalization attempt — 3 November 2026, latest evidence

- [x] Real encrypted Supabase database and private Storage backup exists as encrypted GitHub Artifact `link-in-bio-encrypted-backup-7` in the **Private** `omegapiammani-collab/link-in-bio-backups` repository; backup run #41649973610 passed.
- [x] A fresh private CI run #41664320484 independently downloaded and decrypted the encrypted artifact, checked media SHA-256/manifests and migration presence, and restored **all nine public application tables with data and their RLS policy definitions** into a disposable PostgreSQL 17 database. Auth dependencies in that test were explicitly synthetic stubs.
- [x] Live SQL review: 9/9 public app tables have RLS and policies, Storage media bucket is Private, and Owner-related Storage policies exist. One real Auth user maps to one Owner.
- [ ] **Full isolated Supabase Auth/Storage restoration** remains unverified; synthetic Auth stubs do not establish OAuth/session recovery, restored Storage metadata/bucket policies, or file-byte rehydration.
- [ ] **Real non-Owner Google account test** remains blocked by having only one registered Auth identity. Obtain a second human-controlled Google sign-in and verify it cannot access `/admin` or private media.
- [ ] **Non-empty media recovery** is unverified because the live media bucket currently has **zero** objects. Verify with a genuine file in a properly scoped test or dedicated isolated Supabase environment before closing.
- [ ] **Off-GitHub retained encrypted copy** has not been independently verified. Download the encrypted artifact before **8 December 2026**, store it outside GitHub, and keep the existing recovery passphrase independently in Google Password Manager.
- [ ] Supabase dashboard Email Provider persisted-disabled setting is not independently verified (only the user's prior confirmation). Confirm without enabling email-password signups.
- [x] Private backup vault remains Private; the main public application PR #1 remains Draft/unmerged; no paid-tier upgrade or production restore occurred.

**Decision:** Phase 1 remains **OPEN** until all mandatory acceptance gates have evidence. Never mark complete merely because encrypted backup and public table restore passed.

## Non-Owner Google OAuth acceptance — user observation (3 November 2026)

- [ ] **Second Google non-Owner authorization test is NOT yet valid**. The user initially reported Admin denial, but the subsequent screenshot shows a Supabase OAuth provider failure (`error=server_error`, `error_code=unexpected_failure`) **before a session was established**. Supabase Auth logs at **2026-11-03 15:44:51 UTC** confirmed the provider token exchange failed with HTTP **504**. Do not count that failure as an Owner authorization check.
- [ ] Save a redacted screenshot/status code (no cookies/tokens/email addresses) or review independent server evidence if needed before declaring the Non-Owner flow independently verified.
- [ ] Test non-Owner Storage object list, download, upload and private media API permissions in a genuine second-account session; SQL-based policy checks are already complete but do not replace this end-to-end acceptance.
- [ ] Verify complete isolated Supabase Auth/Storage restore and actual file-byte reinjection in an isolated compatible environment. The isolated public-table restore with synthetic Auth stubs passed, but this is NOT the same as restoring Auth/OAuth or private media.
- [ ] Download/store an encrypted off-GitHub artifact copy, separate from the passphrase, before 8 December 2026. User has not confirmed this.
- [ ] Confirm Email Provider persisted disabled independently without enabling any password auth.
- [x] Phase 1 remains Draft and unmerged; no paid tier or production rollout approved.

## Second-account OAuth callback investigation — 3 November 2026

- [x] Screenshot: login page URL contains `error=server_error&error_code=unexpected_failure` and the provider exchange error category; user was **not authenticated**. The full callback URL and authorization code were not logged into GitHub.
- [x] Read-only Supabase Auth logs at **15:44:51 UTC** show a **504 timeout** and `Unable to exchange external code` category. This is upstream OAuth token exchange, not an App `unauthorized` redirect. The underlying cause (transient provider/network issue versus OAuth credentials) is not confirmed.
- [x] Updated Login page on the feature branch to show a clear Thai provider-failure message, distinct from an Owner-only rejection; displays **allowlisted error categories only**, never raw `error_description`, OAuth codes, tokens or emails.
- [ ] Test the second Google account again using a new browser session, only after successful OAuth exchange. Expected Owner denial is an explicit `/login?error=unauthorized` from the application, **not** `server_error` / `unexpected_failure`.
- [ ] If repeatable: review Supabase Google provider Client ID/Secret pairing, Google's exact authorized redirect URI `https://mmbhuxiejfqipttyujop.supabase.co/auth/v1/callback`, and Google auth provider availability. Do not paste credentials into tickets or chat; do not rotate keys without user approval.
