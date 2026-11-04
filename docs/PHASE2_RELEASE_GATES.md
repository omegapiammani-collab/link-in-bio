# Phase 2 staged-release acceptance gates

**Branch:** \`feature/phase-2-editor-foundation\`. **Hosted Production: unchanged.**
This is an engineering checklist, NOT authorization to deploy, enable public access,
apply hosted migrations, use a paid tier, or merge into \`main\`.

## Verified in an ephemeral GitHub Actions stack

- [x] GoTrue Auth, real signed JWT, PostgREST, Storage HTTP and PostgreSQL
  17 share an isolated database; Owner/Non-Owner/anonymous policies are tested.
- [x] Actual Next.js production server exercises SSR cookies and Owner-gated
  admin routes, audited draft creation/save, CAS conflict and same-origin checks.
- [x] Real Storage HTTP exercises private image byte uploads/downloads,
  Signed URLs and Owner/Non-Owner denial. Separate DR fixture restores both
  file bytes and database permissions and verifies signed downloads.
- [x] New staged SQL migration \`0007_staged_publication.sql\` adds an Owner-only
  explicit publish transaction and a narrowly scoped anonymous published-snapshot
  reader. Both DB release switches default to **false** in the private schema:
  \`app_private.release_settings.publish_enabled\` and \`public_read_enabled\`.
  No \`anon\` SELECT is granted to pages, drafts, versions or audit tables.
- [x] Staged Next.js public route \`/[slug]\` reads immutable published profile
  content only when \`PHASE2_PUBLIC_RENDER_ENABLED=true\`. Explicit Owner
  publish API/UI requires \`PHASE2_PUBLISH_ENABLED=true\`, same-origin, exact
  revision, verified Owner and confirmation. Unlisted remains private.
- [x] Owner-only image upload API enforces max 5 MiB, allowed MIME,
  PNG/JPEG/WebP/GIF header signature and origin validation before Storage upload.
  Owner-only media signed-URL API permits server-generated per-user paths
  and gives 60-second URLs. Both features default off.

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

- \`PHASE2_PAGE_CREATE_ENABLED\`
- \`PHASE2_DRAFT_WRITE_ENABLED\`
- \`PHASE2_PAGE_LIST_ENABLED\`
- \`PHASE2_PUBLISH_ENABLED\`
- \`PHASE2_PUBLIC_RENDER_ENABLED\`
- \`PHASE2_MEDIA_UPLOAD_ENABLED\`
- \`PHASE2_MEDIA_SIGN_ENABLED\`

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
