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
- [ ] Sign in using the intended Google account to create `auth.users`.
- [ ] Read the new User UUID from Supabase Auth dashboard, then bootstrap `owner_config` via privileged SQL and match `OWNER_AUTH_USER_ID` server-only setting.
- [ ] Confirm Owner permitted, non-Owner and signed-out access blocked; test callback, cookie, logout.

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
