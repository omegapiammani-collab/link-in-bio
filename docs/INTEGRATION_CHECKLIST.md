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
- [x] Simulated authenticated Owner: `app_private.is_owner()` returns true. Simulated non-Owner: returns false.\n- [ ] Confirm Google OAuth callback session cookies, actual `/admin` access, sign-out, and protected access in a real browser.

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
