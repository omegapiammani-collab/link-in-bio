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
