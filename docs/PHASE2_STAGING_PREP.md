# Phase 2 isolated staging — deployment preparation (not authorization)

Date: 4 November 2026. **No hosted migration, deployment, Google OAuth settings change, or production mutation is authorized by this document.**

## Verified read-only inventory

| Resource | Isolation and state |
| --- | --- |
| Supabase original | `mmbhuxiejfqipttyujop`, eu-west-2, ACTIVE_HEALTHY. Do not modify. |
| Supabase Phase 2 test | `hfsvnbbckfugrxugrnuc`, ap-southeast-1, ACTIVE_HEALTHY. Separate database and Auth. |
| Phase 2 public Supabase API | `https://hfsvnbbckfugrxugrnuc.supabase.co` |
| Phase 2 Supabase Free database | No application `public` tables and no applied project migrations as checked. |
| Supabase security advisor | No current findings on the empty test project; re-check AFTER future migrations. |
| Existing Cloudflare Worker | `link-in-bio-preview`. Phase 1 Preview. Do not overwrite. |
| Proposed separate Phase 2 Worker | `link-in-bio-phase2-preview` (**not created or deployed**). |
| Proposed separate Phase 2 origin | `https://link-in-bio-phase2-preview.omega-piammani.workers.dev` (**not live**). |
| GitHub branch | `feature/phase-2-editor-foundation`; never deploy `main` as a substitute. |

## Hold points requiring explicit approval

1. **Supabase migrations**: after a distinct authorization, apply project SQL `0001` through `0007` in order **only** to project `hfsvnbbckfugrxugrnuc`, after checking the baseline Supabase-managed `auth` and `storage` schemas. Review the SQL and its effective privileges. Never target the original project.
2. **Bootstrap test Owner**: user signs in via Google on the *test Supabase project*, yielding a distinct `auth.users.id`. Set `public.owner_config` for that new UUID via privileged project-specific operation only after confirmation. Keep Worker `OWNER_AUTH_USER_ID` in sync. Do not copy the production Owner UUID, database or user records.
3. **Google OAuth**: configure a new Google OAuth client or explicitly authorized dedicated test redirect, including the new Supabase OAuth callback `https://hfsvnbbckfugrxugrnuc.supabase.co/auth/v1/callback`. Add Phase 2 Worker `/auth/callback` to the **test Supabase** allowed redirect URLs. No existing Google client modifications without approval. Store Google Client Secret solely in Supabase project Auth Provider secret settings.
4. **Cloudflare**: deploy a *separate* `link-in-bio-phase2-preview` Worker, after explicit deployment approval; use the Phase 2 Supabase URL/key and an Owner UUID verified against **test** `auth.users`. Do not copy existing Worker secrets, routes or bindings.
5. **Feature flags**: at first deploy all `PHASE2_*` flags must be absent or explicitly `false`. In migration `0007`, private release switches must remain `false`. Do not expose published profiles or edit/write routes until their independent gated testing is explicitly approved.
6. **Acceptance**: successful Owner Google sign-in/PKCE and `/admin` access, denied non-Owner in InPrivate, logout and denied reuse of `/admin`, malformed callback failure, RLS, Storage, CORS/CSRF, and rollback paths on the dedicated test environment. Separate the test environment acceptance from Production rollout and operational backup approval.

## Deployment preflight — no cloud writes

```sh
# Provide these as shell environment variables, not as GitHub source code.
NEXT_PUBLIC_SUPABASE_URL=https://hfsvnbbckfugrxugrnuc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key-from-test-project>
OWNER_AUTH_USER_ID=<UUID-from-test-auth-users>
PHASE2_EXPECTED_ORIGIN=https://link-in-bio-phase2-preview.omega-piammani.workers.dev
# All PHASE2_* feature flags absent or set false.
node scripts/verify_phase2_staging_env.mjs
```

The CLI prints validation errors only, not the values of keys or UUIDs.
Offline regression tests run under `npm test` and do not require any live Supabase credentials.

**Do not commit** `.env.local`, tokens, Owner private profile data, OAuth Client Secrets, service-role keys, backups or database passwords.

## Billing constraints

The second Supabase project was approved at a **$0 monthly project creation quote**. Continue on Free plans only. The next resource / deploy approval must verify that Cloudflare Worker creation and traffic remain within Free quotas. If any step reports a nonzero recurring charge, stop and obtain explicit separate authorization; do not auto-upgrade.

**Current gate:** staging prep is complete at source-code/plan level, but no app migration, test Worker, or Google configuration has been applied to the hosted test project.
