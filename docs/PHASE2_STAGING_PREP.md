# Phase 2 isolated staging — deployment preparation (not authorization)

Date: 4 November 2026. **Migrations 0001–0009 were explicitly approved and applied only on isolated Supabase Phase 2 test.** User subsequently approved proceeding toward OAuth setup and a separate Cloudflare test Worker; this does **not** authorize Production changes, paid services, main-branch merges, or exposing credentials.

## Verified read-only inventory

| Resource | Isolation and state |
| --- | --- |
| Supabase original | `mmbhuxiejfqipttyujop`, eu-west-2, ACTIVE_HEALTHY. Do not modify. |
| Supabase Phase 2 test | `hfsvnbbckfugrxugrnuc`, ap-southeast-1, ACTIVE_HEALTHY. Separate database and Auth. |
| Phase 2 public Supabase API | `https://hfsvnbbckfugrxugrnuc.supabase.co` |
| Phase 2 Supabase Free database | Migrations 0001–0009 installed; nine application `public` tables plus the private release-settings table have RLS enabled. No Owner/page records. |
| Supabase security advisor | After 0008/0009, no WARN findings; INFO only: `rls_enabled_no_policy` for the deny-by-default private release-settings table. |
| Existing Cloudflare Worker | `link-in-bio-preview`. Phase 1 Preview. Do not overwrite. |
| Proposed separate Phase 2 Worker | `link-in-bio-phase2-preview` (**not created or deployed**). |
| Proposed separate Phase 2 origin | `https://link-in-bio-phase2-preview.omega-piammani.workers.dev` (**not live**). |
| GitHub branch | `feature/phase-2-editor-foundation`; never deploy `main` as a substitute. |

## Hold points requiring explicit approval

1. **Supabase migrations**: **Completed on 4 November 2026 under explicit authorization**: SQL `0001` through `0009` applied only to `hfsvnbbckfugrxugrnuc`. No further migration or authorization to change Production is implied.
2. **Bootstrap test Owner**: user signs in via Google on the *test Supabase project*, yielding a distinct `auth.users.id`. Set `public.owner_config` for that new UUID via privileged project-specific operation only after confirmation. Keep Worker `OWNER_AUTH_USER_ID` in sync. Do not copy the production Owner UUID, database or user records.
3. **Google OAuth**: configure a new Google OAuth client or explicitly authorized dedicated test redirect, including the new Supabase OAuth callback `https://hfsvnbbckfugrxugrnuc.supabase.co/auth/v1/callback`. Add Phase 2 Worker `/auth/callback` to the **test Supabase** allowed redirect URLs. No existing Google client modifications without approval. Store Google Client Secret solely in Supabase project Auth Provider secret settings.
4. **Cloudflare**: user has approved proceeding toward a separate `link-in-bio-phase2-preview` Worker, but deployment is blocked until safe build credentials and Free-plan status are confirmed. Use the Phase 2 Supabase URL/key and an Owner UUID verified against **test** `auth.users`. Do not copy existing Worker secrets, routes or bindings.
5. **Feature flags**: at first deploy all `PHASE2_*` flags must be absent or explicitly `false`. In migration `0007`, private release switches must remain `false`. Do not expose published profiles or edit/write routes until their independent gated testing is explicitly approved.
6. **Acceptance**: successful Owner Google sign-in/PKCE and `/admin` access, denied non-Owner in InPrivate, logout and denied reuse of `/admin`, malformed callback failure, RLS, Storage, CORS/CSRF, and rollback paths on the dedicated test environment. Separate the test environment acceptance from Production rollout and operational backup approval.

## Deployment preflight — no cloud writes

```sh
# Provide these as shell environment variables, not as GitHub source code.
export NEXT_PUBLIC_SUPABASE_URL=https://hfsvnbbckfugrxugrnuc.supabase.co
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key-from-test-project>
export OWNER_AUTH_USER_ID=<UUID-from-test-auth-users>
export PHASE2_EXPECTED_ORIGIN=https://link-in-bio-phase2-preview.omega-piammani.workers.dev
# All PHASE2_* feature flags absent or set false.
node scripts/verify_phase2_staging_env.mjs
```

The CLI prints validation errors only, not the values of keys or UUIDs. `npm run deploy:vinext` now invokes this check automatically through `predeploy:vinext`; it blocks deployment without the exact test project, staging origin, valid UUID format and all release flags OFF.
Offline regression tests run under `npm test` and do not require any live Supabase credentials.

**Do not commit** `.env.local`, tokens, Owner private profile data, OAuth Client Secrets, service-role keys, backups or database passwords.

## Billing constraints

The second Supabase project was approved at a **$0 monthly project creation quote**. Continue on Free plans only. The next resource / deploy approval must verify that Cloudflare Worker creation and traffic remain within Free quotas. If any step reports a nonzero recurring charge, stop and obtain explicit separate authorization; do not auto-upgrade.

**Current gate:** isolated test migrations 0001–0009 have been verified with no WARN findings, and the Phase 2 branch Cloudflare config has been changed to target only `link-in-bio-phase2-preview`. The staging Worker is not created/live; OAuth provider and redirects are not configured. Cloudflare billing endpoint access is unavailable with the current OAuth connector, so confirm Free plan before deployment.

## Exact Google OAuth setup for the isolated test environment

The Supabase connector does not expose hosted Auth provider configuration APIs; Google OAuth Client Secret must be entered **only through the provider UI** by the account owner. Do not send secrets in chat or commit them.

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), use a dedicated test OAuth **Web application** client rather than modifying the Production OAuth client. The Google **Authorized redirect URI** is exactly:
   `https://hfsvnbbckfugrxugrnuc.supabase.co/auth/v1/callback`
2. In [Supabase Test → Authentication → Providers](https://supabase.com/dashboard/project/hfsvnbbckfugrxugrnuc/auth/providers), configure **Google** using that client's ID and Secret, then enable the Google provider **only in the test project**. No change to the original project.
3. In [Supabase Test → Authentication → URL Configuration](https://supabase.com/dashboard/project/hfsvnbbckfugrxugrnuc/auth/url-configuration), set **Site URL** to:
   `https://link-in-bio-phase2-preview.omega-piammani.workers.dev`
   and add exactly this **Additional Redirect URL**:
   `https://link-in-bio-phase2-preview.omega-piammani.workers.dev/auth/callback`
   Prefer exact URL entries (no wildcards or Production origins).
4. The app's actual login button uses `signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+'/auth/callback'}})`. Its callback exchanges the PKCE code and accepts only an Owner authenticated as the configured test `auth.users.id`. The **Google callback** in step 1 and the **app callback** in step 3 are different and both required.
5. First Owner bootstrap: deploy only with an unrelated, freshly generated *syntactically valid* placeholder UUID (not a Production user ID) and **all features OFF**. The first approved Google login will be denied by the app's Owner check but creates the test Auth identity; inspect **test** Supabase Auth → Users, verify the identity, then explicitly populate the **test** `owner_config` once and update the staging Worker's `OWNER_AUTH_USER_ID` to the newly created test identity. Before that verified Owner ID is provisioned, the app must fail closed. Do not reuse Production's Owner UUID. Never paste Owner email, login tokens, or OAuth secrets into documentation.

## Deployment blockers and safe release order

- The connected Cloudflare account currently lists two existing Workers (`bs-sams`, `link-in-bio-preview`), and no `link-in-bio-phase2-preview`. The feature branch `cloudflare.config.ts` now targets **only** the dedicated proposed staging Worker; a CI regression asserts this to prevent overwriting Phase 1.
- The Cloudflare API connector **cannot read billing/subscription details** with its present OAuth permission (HTTP 403). The [Cloudflare Workers Free pricing page](https://developers.cloudflare.com/workers/platform/pricing/) describes the free tier, but this does not prove the connected account's billing plan. Verify **Workers Free**, no paid-only binding/feature, quota headroom and no upgrade prompt before creating/deploying.
- Building a real vinext/React Server Components Worker needs the compiled application assets and the correct worker runtime/bindings. An API-uploaded placeholder script is **not** a deployed Phase 2 app and must not be represented as one. The connected Cloudflare API alone does not provide GitHub CI artifacts or an authenticated build runner deployment path.
- To deploy, use an approved authenticated Wrangler/vinext build workflow (or appropriately permissioned CI) **after** test-specific publishable key and OAuth configuration. Initial Owner UUID may be an unrelated valid-format bootstrap placeholder that authorizes nobody; subsequently bind the actual verified test Google Auth user's ID. Never copy the Phase 1 Worker bindings, reuse its Supabase project, or publish its routes.
- First staged deployment: all Phase 2 feature flags OFF and database private switches OFF. Then test /login, /admin Owner, InPrivate NonOwner, logout, and hosted direct RPC denial. No Production release or public profiles.


## Cloudflare staging build trigger — 4 November 2026

- Fresh post-restore Phase 2 GitHub Actions CI run [#41835001436](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41835001436) passed the five main jobs; `bootstrap-vinext` was skipped by design.
- Separate Cloudflare Worker `link-in-bio-phase2-preview` is linked via Workers Builds to `feature/phase-2-editor-foundation` with `npm run build:vinext` and `npm run deploy:vinext`.
- Four staging-specific build variable names and four matching runtime binding names were confirmed before this documentation-only push. Their values are managed in Cloudflare, not in source control.
- Test Owner bootstrap UUID remains non-authorizing; release flags and hosted database switches must remain OFF. A successful Worker build alone does not establish Google OAuth or Owner access validation.
