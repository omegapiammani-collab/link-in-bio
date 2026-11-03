# Phase 1 — Foundation & Security

## Verified on 3 November 2026
- GitHub Actions Checks run #2 passed (typecheck, lint, domain tests, Next.js build) on the initial Phase 1 commit.
- Supabase connector is active; one project found (reference `mmbhuxiejfqipttyujop`) on a **Free** organization, status ACTIVE_HEALTHY, PostgreSQL 17.
- Applied `initial_link_in_bio_schema` and `restrict_rls_event_helper_execute` migrations successfully to that Supabase project.
- Verified all nine base tables in public have RLS enabled and currently contain no application data.
- Verified `anon` cannot SELECT `page_drafts` or `page_versions`, and cannot execute the private owner helper.
- Revoked anon/authenticated invocation of the pre-existing `public.rls_auto_enable()` event-trigger function; Security Advisor now reports **no findings**.
- No `auth.users` account yet and no `owner_config` entry, so all Owner authorization remains unconfigured (fail-closed).
- The latest changes to the PR branch still need CI verification; prior successful run is not evidence for the latest commit.

## Pending Phase 1 gates
1. Configure Google OAuth credentials via Google Cloud Console and the Supabase dashboard. Do not paste secrets in ChatGPT or commit credentials.
2. Sign in with the intended Owner Google account to generate `auth.users.id`; bootstrap the single `owner_config` row through privileged SQL only and configure the same `OWNER_AUTH_USER_ID` in server-only runtime settings.
3. Test actual authenticated/non-owner RLS requests and sign-in/callback/logout in a browser; previous catalog privilege checks are **not** a substitute for live authenticated tests.
4. Test a Cloudflare Workers Free **preview** deployment (vinext compatibility and cookies) before authorizing production.
5. Pin dependency versions/lockfile, finalize rate limiting, Storage RLS, errors and audit-write restrictions, and run security/performance validation.
6. Design external database **and storage file** backups and restore tests.

## Existing project note
This was the only connected Supabase project, it had no public application tables or migrations before the Phase 1 schema. Its existing `public.rls_auto_enable()` function was retained and access was restricted. No paid Supabase projects or branches were created.

## Security guardrails
- Never put secret/service-role keys into the repository or frontend.
- Authenticated role alone does not grant Owner rights; both app code and RLS check the Owner UUID mapping.
- Public access to historic `page_versions` and Draft must remain denied.
- The current `page_versions` INSERT policy is a provisional design and is not yet the production-controlled Publish workflow.
- No production deployment or public renderer is in place.
