# Phase 2 staged-release acceptance gates

**Branch:** `feature/phase-2-editor-foundation`. **Hosted Production: unchanged.**
This is an engineering checklist, NOT authorization to deploy, enable public access,
apply hosted migrations, use a paid tier, or merge into `main`.

## Verified in an ephemeral GitHub Actions stack

- [x] GoTrue Auth, real signed JWT, PostgREST, Storage HTTP and PostgreSQL
  17 share an isolated database; Owner/Non-Owner/anonymous policies are tested.
- [x] Actual Next.js production server exercises SSR cookies and Owner-gated
  admin routes, audited draft creation/save, CAS conflict and same-origin checks.
- [x] Real Storage HTTP exercises private image byte uploads/downloads,
  Signed URLs and Owner/Non-Owner denial. Separate DR fixture restores both
  file bytes and database permissions and verifies signed downloads.
- [x] The SQL public reader filters **inactive** profile links BEFORE returning JSON to anonymous clients; direct RPC callers cannot retrieve hidden link URLs. A dedicated regression also tests disabling anonymous reads at the private database switch.
- [x] New staged SQL migration `0007_staged_publication.sql` adds an Owner-only
  explicit publish transaction and a narrowly scoped anonymous published-snapshot
  reader. Both DB release switches default to **false** in the private schema:
  `app_private.release_settings.publish_enabled` and `public_read_enabled`.
  No `anon` SELECT is granted to pages, drafts, versions or audit tables.
- [x] Staged Next.js public route `/[slug]` reads immutable published profile
  content only when `PHASE2_PUBLIC_RENDER_ENABLED=true`. Explicit Owner
  publish API/UI requires `PHASE2_PUBLISH_ENABLED=true`, same-origin, exact
  revision, verified Owner and confirmation. Unlisted remains private.
- [x] Owner-only image upload API enforces max 5 MiB, allowed MIME,
  PNG/JPEG/WebP/GIF header signature and origin validation before Storage upload.
  Owner-only media signed-URL API permits server-generated per-user paths
  and gives 60-second URLs. Actual Next.js HTTP + Storage regression verifies
  rejection of Non-Owner, cross-origin, spoofed PNG and traversal attempts,
  and successful byte-identical signed retrieval. Both features default off.

## Manual Google OAuth verification on existing Phase 1 Preview — 4 November 2026

- [x] **Owner account, existing Preview:** user-supplied screenshot showed a protected `/admin` dashboard identifying an authenticated Owner at `https://link-in-bio-preview.omega-piammani.workers.dev/admin`. This demonstrates Owner access, not by itself full PKCE exchange instrumentation.
- [x] **Logout, existing Preview:** user-supplied screenshots showed return to `/login` and subsequent attempted Admin navigation remaining on Login without signing in.
- [x] **Non-Owner Google account, existing Preview (user-reported):** user stated they tested with a different Google account in Edge InPrivate and **Admin access was denied**. Record as a manual user attestation, not a screenshot-backed or tool-observed result; do not store identity, tokens or personal details.
- [ ] **Phase 2 parity is still OPEN:** the existing Preview serves an older Phase 1 build, so none of these manual passes independently proves the un-deployed Phase 2 Google OAuth callback, Owner denial or Cloudflare runtime parity. Perform equivalent tests on an expressly approved, separate Phase 2 test deployment before closing its acceptance gate.

No production changes, OAuth credentials, secrets, deployments, or account settings were made to document this evidence.

## Isolated Supabase Free Phase 2 test project — 4 November 2026

- [x] New isolated test project `hfsvnbbckfugrxugrnuc` created in Singapore on the existing Free Organization; quoted project cost USD 0/month. Existing `mmbhuxiejfqipttyujop` remains separate and untouched.
- [x] Read-only checks: test project ACTIVE_HEALTHY, no application public tables, no applied project migrations and no current security-advisor findings in this empty state.
- [x] Added fail-closed offline staging configuration checks in `scripts/verify_phase2_staging_env.mjs` and documented an approval-gated sequence in `docs/PHASE2_STAGING_PREP.md`.
- [ ] Hosted test migrations 0001–0007, Google OAuth and dedicated Cloudflare Worker remain **not applied / not deployed**, pending separate approval.

## Unmet external / release-specific gates

- [ ] **Real Google OAuth happy-path + PKCE callback** tested end-to-end with
  the intended Google Owner account against an approved, separate testing origin.
  Invalid/missing PKCE code rejection and SSR logout have isolated HTTP tests;
  these do **not** replace a successful Google provider login.
- [ ] **Real Non-Owner Google account denial** exercised with a separate Google
  identity in a dedicated test environment. Synthetic Non-Owner GoTrue password
  accounts already pass, but the Google-provider flow is still unverified.
- [ ] **Cloudflare + Supabase Free deployment parity** tested separately, with
  signed cookies, callback URLs, server runtime configuration and free quotas.
  A successful Cloudflare build is not a deployment acceptance.
- [ ] **Hosted migration and release approval** granted by the owner after
  independent security review. Database switches and Next.js flags must be
  enabled only through an explicit rollout plan, with a rollback action.
- [ ] **Operational backups**: independently verified encrypted off-site
  backup sets, actual hosted Auth/Storage byte recovery and retention schedule.
  Disposable CI recovery is not evidence that hosted backups exist.
- [ ] Confirm whether Phase 2's profile/theme/social/media UI scope requires
  visual themes, social icon layouts and a publicly rendered avatar. The current
  release renders validated profile text and external links; private image
  upload/sign endpoints do not automatically embed media on public profiles.

## Server flags (all default OFF)

- `PHASE2_PAGE_CREATE_ENABLED`
- `PHASE2_DRAFT_WRITE_ENABLED`
- `PHASE2_PAGE_LIST_ENABLED`
- `PHASE2_PUBLISH_ENABLED`
- `PHASE2_PUBLIC_RENDER_ENABLED`
- `PHASE2_MEDIA_UPLOAD_ENABLED`
- `PHASE2_MEDIA_SIGN_ENABLED`

**Security warning:** A signed URL grants temporary access to its holder for
its validity period; it is not a permanent public media URL. Direct RPC calls
cannot override the private database release switches without privileged
database access.

The CI test updates these DB switches **only inside disposable PostgreSQL**.
Neither the migrations nor flags have been applied or enabled on hosted
Supabase or Cloudflare. No new service subscription is authorized.

## Release decision

Phase 2 is **staged in source control; NOT production-complete**. Do not mark
it complete until all applicable external and product-scope gates above are
verified. Preserve the 0 THB/month paid-services target and stop before any
resource requires payment.

## Recent ephemeral CI evidence (4 November 2026)

- [GitHub Actions #41790905841](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41790905841): passed staged public/unlisted snapshot and release HTTP tests.
- [GitHub Actions #41791845574](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41791845574): passed default-off DB release interlock, Owner media upload/sign through Next HTTP, Supabase Storage recovery and Cloudflare build.
- Additional inactive-link filtering regression added in a later commit; check the latest CI run before calling it passed.
