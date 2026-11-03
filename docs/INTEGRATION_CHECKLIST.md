# Phase 1 integration checklist — live verification pending

**No credentials belong in Git, ChatGPT messages or PR comments.** Configure secrets only in the approved provider dashboards / local ignored environment files.

## A. Supabase Free project

- [ ] Create or select a **Free** Supabase project. Record project URL and *publishable* key in `.env.local` (ignored by Git).
- [ ] Confirm Free plan, no paid usage / overage enabled, and storage/database quotas.
- [ ] Review `supabase/migrations/0001_initial_schema.sql` before applying. Apply to a dedicated development project before production.
- [ ] Verify tables/constraints and that RLS is enabled for each table. `anon` must never directly read `page_drafts`, `page_blocks`, `page_versions`, `owner_config`, or `audit_events`.
- [ ] Do not store service-role credentials in `NEXT_PUBLIC_*`, client code, Actions logs or repository secrets exposed to PRs.

## B. Google OAuth (Owner-only)

- [ ] In Google Auth Platform, configure an OAuth web client. For initial local testing use Supabase Auth's **exact callback URL** copied from the Supabase dashboard (not the app's `/auth/callback` URL).
- [ ] In Supabase Authentication > Providers > Google, configure OAuth client ID and secret via dashboard only.
- [ ] In Supabase Authentication URL settings, set Site URL and allow `http://localhost:3000/auth/callback` for local development. Add the final Cloudflare deployment origin only after its exact URL exists. Do not use unbounded wildcard redirect rules.
- [ ] First sign in once with the intended Google account to create the `auth.users` record. Until the Owner UUID is configured, access must **fail closed**.
- [ ] Verify `auth.users.id` matches the intended identity. Via privileged SQL Editor, insert the single `owner_config` row after applying the migration. Set `OWNER_AUTH_USER_ID` to the same UUID in server-only configuration.
- [ ] Test: Owner can access `/admin`; other Google account gets no admin permissions; signed-out visitor gets no admin permissions.
- [ ] Test: callback exchanges code securely; cookies persist; logout clears session; SSR does not cache authenticated admin responses.

## C. RLS acceptance tests (run against actual Supabase, not only SQL review)

- [ ] **anon**: all private tables return no rows / deny writes even if UUIDs are known.
- [ ] **authenticated non-owner**: cannot SELECT/INSERT/UPDATE/DELETE `pages`, `page_drafts`, `page_blocks`, `media_assets`, `slug_history`, `backup_manifests`.
- [ ] **authenticated Owner**: can manage allowed Draft and Page rows.
- [ ] **owner_config**: no browser user can INSERT, UPDATE or DELETE the Owner mapping.
- [ ] **page_versions**: browser user cannot UPDATE or DELETE immutable versions; production Publish should be a future controlled server/DB operation.
- [ ] **audit_events**: browser user cannot UPDATE or DELETE past events; new events require server-side validation of permitted event types.
- [ ] **public renderer**: ensure anonymous route cannot retrieve Draft or historical snapshots from a previous public version.
- [ ] Re-test after every RLS policy or permissions change.

## D. GitHub and Cloudflare readiness

- [x] GitHub repo initialized and Phase 1 draft PR created.
- [x] GitHub Actions Checks (typecheck/lint/tests/build) reported success.
- [ ] Verify Next.js adapter/vinext with current Workers Free documentation and free account quotas.
- [ ] Preview deployment only after secrets are configured; never claim production is deployed until verified.
- [ ] Test sessions and redirects on actual Workers runtime. Local Next.js build alone is insufficient.
- [ ] Record Cloudflare CPU and request consumption, no paid overages, and Go/No-Go results.

## Acceptance gate

Phase 1 is **not complete** until live Supabase OAuth/RLS and Cloudflare compatibility tests pass. If an account or authorization is unavailable, stop at documentation and report the blocker rather than inventing a pass.
