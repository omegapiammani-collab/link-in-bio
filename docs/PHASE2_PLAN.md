# Phase 2 — Profile and Link Editor

**Status:** Preview scaffold only. This phase is developed on `feature/phase-2-editor-foundation`, branched from the unmerged Phase 1 feature branch. The application's `main` remains unchanged and no production publish is authorized.

## Delivered in this initial slice

- Owner-gated `/admin/editor` via the same server-side authorization helper as `/admin`.
- Client-only bilingual-ready profile/link editor with accessible fields, link order controls, active toggles, inline validation, and a non-clickable preview.
- Data is held only in React state. Refresh clears changes. **No Supabase writes, network requests, storage uploads, or published pages** are performed.
- Save and Publish intentionally remain unavailable until reviewed server-side transactions, audit events, optimistic concurrency, rollback and authorization are implemented and CI tested.

## Safety and acceptance backlog

1. Define profile, theme, social links and link-block data contracts and security validation. Enforce http(s) links, max lengths and safe block types server-side as well as in the UI.
2. Add owner-only draft creation and updates with optimistic revision checks, audited server routes, consistent validation and RLS tests. No service-role secrets in the browser.
3. Add immutable publish transaction, version increment, atomic published snapshot pointer and append-only audit event; test rollback and conflict handling in isolated PostgreSQL.
4. Add public renderer that reads only an explicitly published snapshot through a narrowly scoped server endpoint; no anonymous access to draft, user or audit tables.
5. Add private media signed URL flow with strict owner authorization, file type/size checks and time-limited URLs.
6. Confirm phase 1's waived/unfinished full Auth/Storage disaster recovery is **not** reclassified as passed. Record the user's decision to defer that testing, and complete it before any production rollout.

## Explicit out-of-scope

- No production launch, paid services, migration applied to live Supabase, phase-1 PR merge, or modifications to existing GitHub Secrets.
- No claim that the editor persists changes or publishes pages.

## Phase 2 second slice — draft persistence foundation (4 November 2026)

### Implemented in this feature branch only

- [x] Strict shared document contract for profile name, description and at most 20 link entries. Only external HTTP(S) URL syntax with no credentials, whitespace, local hostnames or numeric IPv4 literals is accepted; validated **server-side** on write. Unique valid UUID link IDs are enforced.
- [x] Private route `GET/PATCH /api/admin/drafts/[pageId]`, deliberately **disabled by default** unless `PHASE2_DRAFT_WRITE_ENABLED=true` is explicitly set in an **isolated development environment**. The production Preview has not been configured to enable it.
- [x] Route requires server-side verified Owner Google session, a valid page UUID, and same-origin on PATCH; rejects invalid JSON/oversized payloads, and sets no-store response headers. Uses existing RLS-authenticated Supabase SSR client, **not** service_role.
- [x] Single atomic conditional UPDATE on existing `page_drafts` row requires exact `revision`; successful save increments revision, stale update receives HTTP 409, failed DB operation is 500. Unit tests include stale-write conflict and malformed documents.
- [x] There is **no draft creation endpoint**, migration or UI save action enabled. Existing-page-only reads and updates are intentionally gated because a complete audited creation/publishing transaction and end-to-end RLS tests are still pending.

### Next acceptance steps (not yet passed)

1. Run read/write API integration tests against an isolated Supabase Stack (synthetic Owner and Non-Owner users, no live database), including 401/403, 409 conflict, and persistence.
2. Add atomic Owner-only page+draft creation and block persistence; preserve revision guarantees across link order and content, without creating orphaned records on errors.
3. Wire the UI to the draft API **only in an isolated test deployment**, implement save/refresh/conflict UX, and keep explicit publish disabled.
4. Add append-only audit / immutable versioning with transactional SQL functions before enabling any hosted write path.
5. Keep the user's deferred full Auth/Storage disaster recovery labeled as a **waived test, not a PASS** before any production release.

**Safety controls:** No mutation of hosted Supabase, no GitHub Secrets changes, no production deployment, no merge to `main`, no paid tier.

## Phase 2 security validation increment — 4 November 2026

- [x] Hardened the shared external-link validator against URL-parser canonicalization bypasses (decimal, octal and hexadecimal IP literals), IPv6 literals, trailing-dot or malformed hostnames, credentials, whitespace and reserved local-domain suffixes.
- [x] Reused the same shared URL validator in the client preview/editor so preview validity is aligned with the server draft contract.
- [x] Updated the editor's example link ID to a valid UUID, consistent with the server draft contract.
- [x] Added Node regression tests for accepted public domains and rejected private/local/numeric hostnames.
- [ ] Verify the new commit's CI run succeeds; no PASS claim until results are observed.
- [ ] Hosted draft writes, transactional page creation, audit/publish and production remain **disabled**.
- [ ] This validation enforces a syntactic DNS-host policy only. It does not resolve DNS, evaluate redirects or provide SSRF protection for a future server-side URL fetcher; any such feature needs dedicated network controls.

## Phase 2 existing-draft editor integration — 4 November 2026

- [x] Introduced `src/lib/domain/draft-api.mjs`, a client-side request adapter using same-origin credentials, no-store fetch, strict response contract checking and explicit 409 failure mapping.
- [x] The Owner-gated editor can load and save an **existing** draft identified by the query parameter `pageId=<UUID>`, but only when server-side `PHASE2_DRAFT_WRITE_ENABLED=true` and API authorization both allow it.
- [x] Saving uses the exact loaded `revision`; a 409 freezes further saves until the Owner explicitly reloads the latest draft. Reload warns before discarding unsaved changes.
- [x] The default view remains an in-memory preview with Save disabled. No page creation, publishing, public renderer, media upload or service-role credential is introduced.
- [x] Added contract tests for reads, writes, stale-revision 409, invalid documents, invalid IDs, bad success responses and disabled-route failures.
- [ ] **No isolated Owner/Non-Owner HTTP integration test completed yet**. No claim of persisted hosted writes. The feature flag remains disabled on the current deployment.
- [ ] Add atomic audited page+draft creation and draft-save audit transaction before widening write access. Ensure the current conditional UPDATE path is tested against real RLS and an isolated Supabase stack.
- [ ] Production deployment, `main` merge and previously deferred full Auth/Storage disaster recovery remain blocked.

## Phase 2 audited creation and save transaction — 4 November 2026

- [x] Added **unapplied** migration `0005_audited_draft_transactions.sql` with private Owner-checked transactional functions and narrow public `SECURITY INVOKER` RPC wrappers. Database writes were **not** executed against hosted Supabase.
- [x] Atomic creation: `pages` + `page_drafts` + `audit_events` succeed or fail together; pages start as unlisted drafts.
- [x] Atomic save: compare-and-swap revision, update of `profile_json`, and append-only `draft.saved` audit entry succeed or fail together.
- [x] Migration revokes direct authenticated INSERT/UPDATE/DELETE on `pages` and `page_drafts`, retaining authenticated read under Owner RLS. The migration also validates basic JSON/link shapes, UUIDs, link uniqueness and a restricted URL syntax in the RPC layer; Next.js runs the stricter shared URL validation before any RPC call.
- [x] Added `POST /api/admin/pages` with **two** disabled-by-default server-side flags (`PHASE2_PAGE_CREATE_ENABLED`, `PHASE2_DRAFT_WRITE_ENABLED`), server-side Owner verification, same-origin and payload limits, slug protection and atomic RPC.
- [x] Switched the existing gated PATCH API to audited RPC instead of direct UPDATE. 409 conflicts are returned for stale revisions.
- [x] Added repository regression tests checking that audited RPCs, authorization, and table permission restrictions exist.
- [ ] **Migration is not yet tested on a real isolated Supabase PostgreSQL stack.** Source-level checks alone cannot prove SQL syntax, rollback behavior, privilege enforcement, 409 handling or RLS end-to-end.
- [ ] Create a disposable Supabase environment, apply the migration only there, run Owner/Non-Owner and conflicting-writer integration tests, plus audit-INSERT failure rollback tests. Review SQL function privileges with Supabase security advisors.
- [ ] No public renderer, actual publishing, production deployment, GitHub secret modification, paid tier, or merge to main.

## Isolated PostgreSQL transaction exercise — 4 November 2026

- [x] Added `tests/audited_transactions_fixture.sql` to run against the disposable PostgreSQL 17 Docker service already provided by GitHub Actions, without connecting to hosted Supabase.
- [x] CI run [#41768046909](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41768046909) completed the `Test audited draft transactions in isolated PostgreSQL 17` step successfully, including SQL migration execution, synthetic Owner vs Non-Owner authorization, draft conflict, forced audit-failure rollback, and rejected direct draft UPDATE.
- [ ] The fixture uses locally defined `auth.uid()` and ownership helper instead of full Supabase Auth/API/RLS; **a complete Supabase-stack integration test remains mandatory** before any hosted write flag can be enabled.
- [ ] The application build and CI's overall result on this latest workflow must be inspected separately before marking all checks passed.

## RPC direct-call security tests — 4 November 2026

- [x] Closed a validation gap: callers can invoke authenticated RPCs without traversing the Next.js endpoint, so PostgreSQL now applies an ASCII-DNS authority allowlist and rejects numeric IP hosts, IPv6 URL hosts, userinfo, whitespace/backslashes, local suffixes and malformed authority syntax.
- [x] Expanded the isolated PostgreSQL fixture with direct-RPC negative tests, a valid external-link positive test, and an authenticated Non-Owner save denial.
- [ ] Re-run PostgreSQL integration CI after correcting a PostgreSQL `substring` syntax issue discovered in the first run. The earliest expanded test **failed** and must not be recorded as PASS. No hosted Supabase mutation was attempted.
- [ ] This DNS-format validation does not itself prevent DNS rebinding or malicious redirects if the server later fetches URLs. The current application does not perform such URL fetches.

## Isolated RLS regression and new-page UI — 4 November 2026

- [x] Extended the disposable PostgreSQL 17 CI fixture to enable **actual PostgreSQL RLS** on pages, drafts and audit, proving that a synthetic Owner sees permitted records and a synthetic authenticated Non-Owner sees zero private rows. Also verifies atomic page+draft rollback when the audit INSERT is intentionally failed.
- [x] These database checks passed in [GitHub Actions #41769399290](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41769399290). This is **PostgreSQL RLS with a synthetic auth.uid() helper**, not a full Supabase Auth HTTP integration.
- [x] Added an Owner-gated `/admin/new` page and form for creating a private, unlisted draft. This is **hidden and inaccessible by default** unless both `PHASE2_PAGE_CREATE_ENABLED=true` and `PHASE2_DRAFT_WRITE_ENABLED=true` are enabled in an isolated development deployment. A successful response redirects to the existing Owner draft Editor.
- [x] Added a same-origin `createNewDraftPage` client adapter and unit tests for accepted slugs, reserved/malformed slugs, duplicate slugs, disabled server responses and invalid success payloads.
- [ ] Confirm the new UI CI run completes successfully; no production operation was performed.
- [ ] Still required before enabling hosted writes: full isolated Supabase Auth/PostgREST/Storage behavior with real Auth tokens, real existing migration/RLS, owner and non-owner API requests, audit rollback and feature-flag validation.
- [ ] Remain explicitly blocked: applying migration 0005 to hosted Supabase, updating deployment flags, any production deployment and merging into `main`.

## Disposable PostgREST JWT/RLS HTTP integration — 4 November 2026

- [x] Added `tests/postgrest_setup.sql` for an isolated PostgREST authenticator role and JWT claim reader, using **CI-only synthetic credentials** and PostgreSQL 17. No hosted Supabase connection, dashboard mutation, GitHub Secrets or live user account is involved.
- [x] Added `tests/postgrest-http.mjs` with **15 real HTTP assertions**, using HS256 JWTs signed by a local fixture-only test secret. The checks include anonymous/non-owner RPC denial, Owner RPC create/save, owner-only RLS reads, stale revision conflict, direct table-write denial, audit visibility, duplicate slug and malformed JWT rejection.
- [x] Added a GitHub Actions step running pinned `postgrest/postgrest:v14.18` against the disposable PostgreSQL service, with connection and API credentials explicitly scoped to the CI fixture.
- [x] [GitHub Actions #41770136566](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41770136566) successfully completed the isolated HTTP assertion step (**15 passes**) and the offline PG17 audit/rollback tests.
- [ ] This is **genuine PostgREST HTTP/JWT/PostgreSQL-RLS testing**, but it is *not* the official Supabase local Auth stack: the fixture substitutes `auth.uid()` and synthetic auth roles. Full isolated Supabase Auth, SSR cookies, Google OAuth redirect, Storage and real migrations 0001–0004 remain separate acceptance gates.
- [ ] Continue to leave all Phase 2 write flags disabled in hosted deployments and migration 0005 unapplied to hosted Supabase. Production deployment, paid plans and merge to main remain blocked.

## Owner multi-page index — 4 November 2026

- [x] Added a read-only, Owner-authenticated page index at `/admin/pages` plus `GET /api/admin/pages`, protected by the separate **disabled-by-default** `PHASE2_PAGE_LIST_ENABLED=true` flag.
- [x] Queries only page metadata (`id`, `slug`, `status`, `visibility`, `updated_at`), excludes soft-deleted pages, uses a deterministic descending update order and caps results at 50. Private drafts and audit data are not returned by this index.
- [x] The Owner dashboard shows a list navigation link only when the flag is enabled. Each draft's editor link is rendered only if `PHASE2_DRAFT_WRITE_ENABLED=true`; archived, trashed, or published versions cannot be edited through the listing.
- [x] Added unit checks for flagging, authentication, query bounding and read-only behavior, plus three real PostgREST RLS HTTP assertions covering Owner, Non-Owner and anonymous list access.
- [ ] Full official Supabase Auth + SSR cookie session + Storage integration and migrations 0001–0004 have not yet been exercised together in an isolated Supabase stack. These are still prerequisites to enabling hosted writes or public publishing.
- [ ] No migration or writes to hosted Supabase, no production deployment, and no merge to main.

## Owner authorization identity hardening — 4 November 2026

- [x] Added pure `src/lib/auth/owner-policy.mjs` requiring a valid RFC 4122 variant/version UUID for `OWNER_AUTH_USER_ID`; rejects malformed lookalikes, placeholders, unset values and whitespace rather than accepting any 36-character string of dashes/hex.
- [x] Updated the server `getOwner()` helper to call `supabase.auth.getUser()` and apply the shared fail-closed identity matcher; rejects authentication errors or different user IDs.
- [x] Added unit regressions in `tests/owner-policy.test.mjs` for malformed config, case-insensitive UUID comparison, non-owner sessions, and failed auth responses.
- [ ] This change does **not** constitute full Supabase Auth HTTP/cookie/OAuth integration or full Storage recovery acceptance. Existing production feature flags remain disabled.

## Auth failure-mode regression — 4 November 2026

- [x] Added `verifyOwnerSession()` as an isolated async verification boundary, using `supabase.auth.getUser()` and rejecting unverified session lookups; an invalid Owner UUID prevents any Auth request.
- [x] Fail-closed handling now covers Auth SDK exceptions, network faults and server client configuration errors without granting any Owner privileges.
- [x] Added offline tests for valid Owner, other users, expired/errored responses, thrown Auth errors, missing clients and prevention of `getSession()` use in permission checks.
- [ ] Still requires actual Supabase Auth HTTP + SSR cookie + Google OAuth E2E tests in a disposable stack before any hosted write mode is enabled.

## Editor request locking and unsaved-change safeguards — 4 November 2026

- [x] Added an in-flight ref lock to suppress rapid duplicate draft saves and prevent a reload while a save is pending (and vice versa). Existing revision compare-and-swap and 409 conflict state remain authoritative.
- [x] Added a native browser `beforeunload` warning only for **existing drafts with unsaved changes**; the in-memory-only preview is not interrupted. The Owner still explicitly confirms reload before discarding unsaved edits.
- [x] Keyed the Editor component by its page UUID to prevent stale local revision/document state from leaking when navigating between different draft pages.
- [x] Hardened the PATCH endpoint to enforce the 32-KiB limit on actual UTF-8 request bytes (not JavaScript code unit counts), with malformed declared payload lengths rejected.
- [x] Added `tests/editor-safety.test.mjs` regression checks for these guards.
- [ ] Browser navigation through client-side router links and actual authenticated Supabase SSR/Google OAuth still require isolated end-to-end testing. The browser's default unload dialog text is controlled by the browser.
- [ ] All hosted write flags remain off, migration 0005 unapplied to hosted Supabase, and no public publishing/production rollout is authorized.

## Deterministic JWT negative regression — 4 November 2026

- [x] Fixed an intermittent synthetic JWT test error: mutating the last base64url character may alter unused padding bits without changing the signature bytes. The negative test now modifies the first signature character and deterministically invalidates the HMAC.
- [ ] Check the new GitHub Actions results for commit `f5b8022e` before claiming a full CI pass.
- [ ] No hosted Supabase writes, production flag changes, deployment or merge into main were performed.

## Actual Phase 1 schema compatibility CI — 4 November 2026

- [x] Added `tests/real_schema_compat_fixture.sql`, applying the repository's actual `0001_initial_schema.sql` and `0005_audited_draft_transactions.sql` in a **separate disposable PostgreSQL 17 database**. Only Supabase-managed `auth.users` and `auth.uid()` are stubbed; the application tables, foreign keys, constraints, original RLS policies, Owner bootstrap, and Phase 2 RPC functions are loaded unchanged.
- [x] Verified schema compatibility for Owner-only page creation, draft revision update, append-only audit events, anonymous grants, and Non-Owner visibility/denial.
- [x] Switched the disposable PostgREST HTTP integration to this **actual schema database**, rather than the earlier hand-crafted base-table fixture. CI [#41772868572](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41772868572) passed both the real-schema migration step and the HTTP JWT/RLS/RPC step.
- [ ] This is **not** a complete Supabase local stack: `auth.users`/`auth.uid()` remain synthetic, and migrations `0002`–`0004`, Supabase Auth/SSR cookies, Google OAuth, Storage, and full DR are not covered by this compatibility check. Do not infer production readiness.
- [ ] Keep migration 0005 **unapplied** to the hosted project, all write flags disabled in production, and do not deploy or merge to `main`.

## Staged immutable publishing core — 4 November 2026

- [x] Added **unapplied** `supabase/migrations/0006_immutable_publish_core.sql`. Its internal-only `app_private.publish_draft_snapshot(page_id,expected_revision)` requires authenticated Owner identity, locks page and draft, checks revision, validates profile, captures profile/theme/socials/ordered blocks, inserts a new version, atomically advances the page's published pointer and writes an audit record. A failure rolls back the entire transaction.
- [x] Published snapshots preserve the existing page visibility as **unlisted**, even when status becomes `published`. There is **no public renderer**, no exposed `public.publish_*` RPC, no authorized EXECUTE grant to authenticated, and **no Publish UI or enabled release feature flag**.
- [x] Added a database trigger rejecting UPDATE/DELETE on `page_versions`, plus revoked direct authenticated INSERT on `page_versions` and `audit_events`; historical snapshot and audit insertions must pass through privileged audited transactions.
- [x] Draft save is allowed on both draft and already-published pages, keeping the currently published snapshot unchanged until a separate authorized publish. Successive publish calls retain version ancestry and monotonic version numbers.
- [x] Added `tests/immutable_publish_fixture.sql` exercising version pointers, archival immutability, stale-revision rejection, republishing after draft edits, Owner and Non-Owner restrictions, direct-insert denial and forced audit-failure rollback on the **real Phase 1 schema** in isolated PostgreSQL.
- [x] Extended real PostgREST HTTP tests to assert that authenticated Owner cannot access the private publishing function over the public Data API.
- [ ] Official Supabase Auth+Storage/SSR-cookie integration and migrations `0002`–`0004` remain unverified end-to-end; no hosted database migration, production deployment, release flag change, publishing UI, or `main` merge is authorized.

## Isolated full migration-order and SSR cookie regression — 4 November 2026

- [x] Located and verified the actual Phase 1 migration filenames: `0002_restrict_rls_helper.sql`, `0003_foreign_key_indexes.sql`, and `0004_harden_publishing_audit_and_media.sql`.
- [x] Extended the existing disposable PostgreSQL 17 compatibility suite to apply **all six repository SQL migrations (0001–0006) in order**, without modifications to the migrations or to a hosted Supabase database. The separate `tests/isolated_supabase_prerequisites.sql` supplies only synthetic Supabase-owned Storage metadata/object tables and the pre-existing RLS helper absent in vanilla PostgreSQL.
- [x] Exercised the actual `0004` Storage RLS policies: Owner insert/SELECT succeeds; authenticated Non-Owner cannot list or insert objects. Checked the private bucket's 5-MiB and MIME metadata. This validates PostgreSQL policy semantics, **not the actual Supabase Storage API, file upload processing, or bucket-side MIME enforcement**.
- [x] Added `tests/ssr-cookie-auth.test.mjs` using the actual `@supabase/ssr` SDK and an in-memory cookie adapter against a **local fake Auth HTTP response handler**. Tests verify session persistence across server-client creation, fresh `getUser()` identity verification, Non-Owner denial, Auth 401 fail-closed behavior and empty-cookie denial. No external network, real credentials, or actual Google login involved.
- [x] CI [#41774487806](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41774487806) passed full migration order including Storage policy checks and PostgREST; CI [#41774632397](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41774632397) passed `npm run check` including the new SSR cookie tests.
- [ ] The **actual local Supabase Auth (GoTrue), Storage HTTP, Google OAuth redirects, full cookie proxy flow and Auth/Storage recovery exercise** remain unverified. These are still blocked from Production acceptance.
- [ ] No changes to hosted database, production deployment, feature flags, GitHub Secrets, `main`, or paid service subscriptions.

## Real isolated Supabase Auth (GoTrue) HTTP regression — 4 November 2026

- [x] Added `tests/gotrue-auth-http.mjs` and an independent GitHub Actions `isolated-gotrue-auth` job. The job starts pinned `supabase/gotrue:v2.197.0` against a **disposable PostgreSQL 17** database in the GitHub Actions runner, not against any linked or hosted Supabase project. No external OAuth providers, real credentials, GitHub secrets, hosted database writes or paid service were used.
- [x] The isolated test registers two synthetic accounts through the real GoTrue HTTP signup endpoint, signs in through the actual `@supabase/ssr` SDK, validates cookie persistence and server-side `auth.getUser()` authorization, denies a real Non-Owner account and missing cookies, and verifies logout denies continued access.
- [x] CI required explicit creation of the `auth` schema and its PostgreSQL search path for standalone GoTrue. The SDK must receive a project-root URL (not an `/auth/v1` path) and the isolated fetch adapter forwards requests only to `127.0.0.1`. See the preceding failed startup/configuration CI attempts; no false PASS is recorded for them.
- [x] [GitHub Actions #41775460546](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41775460546) successfully completed its **real GoTrue HTTP + SSR Cookie** test step and the separately isolated PostgreSQL/PostgREST and check/build steps.
- [ ] The new GoTrue job is a real Auth service integration **but does not yet prove a GoTrue-issued JWT against the project's application PostgREST/RLS in the same disposable database**, a real Google OAuth redirect, real Storage HTTP upload/download, Next.js cookie proxy, or full Auth/Storage disaster recovery.
- [ ] All `PHASE2_*` Production feature flags remain disabled, migrations 0005/0006 unapplied to hosted Supabase, no hosted changes and no merge to `main`.

## Real GoTrue JWT → PostgREST → application RLS — 4 November 2026

- [x] Added `tests/gotrue_full_schema.sql`, applying **unchanged migrations 0001–0006** to the same disposable PostgreSQL 17 database where the actual GoTrue `auth.users` and `auth.uid()` already exist. The storage schema/object tables and prior RLS event helper are still minimal fixtures because this CI job does not start the Storage HTTP service.
- [x] Extended `isolated-gotrue-auth` to launch the pinned PostgREST v14.18 container alongside GoTrue v2.197.0, pointing both services at the **same database**, with a shared CI-only JWT signing secret. No actual Supabase project keys, hosted connections or real Google accounts are involved.
- [x] Enhanced `tests/gotrue-auth-http.mjs`: register two real GoTrue test users, bootstrap `owner_config` through an isolated privileged PostgreSQL connection (referencing actual `auth.users`), and use the **real GoTrue-issued access tokens**, not test-signed tokens, to call PostgREST.
- [x] Verified real Owner create/save RPC and audit reads; authenticated Non-Owner and anon creation denial; Non-Owner RLS SELECT isolation; direct draft PATCH blocked; private Publish RPC hidden; modified JWT signature rejected. GoTrue `auth.getUser()`, SSR cookie restoration and signout tests remain active.
- [x] [GitHub Actions #41780754439](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41780754439) passed the real GoTrue + real JWT + PostgREST integration, legacy isolated migration/RLS suite, typecheck/unit tests and both application builds.
- [ ] This integration is not a full Supabase deployment: **Storage HTTP, signed media URLs, live Google OAuth redirect flow, actual Next.js middleware/cookie routing, and Auth/Storage restore testing** still need isolated acceptance. Logging out clears SSR login state but does not by itself prove all previously issued JWTs are instantly invalidated.
- [ ] All hosted flags and migrations remain unchanged; no production deployment, paid services, secrets changes or merge to main.

## Real GoTrue JWT storage metadata RLS and disposable Auth/metadata DR — 4 November 2026

- [x] Extended the isolated GoTrue + actual migration + PostgREST job to additionally expose the **disposable** `storage` schema for API testing only. `tests/gotrue-auth-http.mjs` now uses **real GoTrue-signed Owner and Non-Owner access tokens** to test `storage.objects` through PostgREST HTTP: anonymous read denied, Non-Owner INSERT denied, cross-bucket insertion rejected, Owner INSERT/SELECT/DELETE permitted, and Non-Owner UPDATE/DELETE cannot mutate or remove the Owner record.
- [x] No public Storage bucket or unrestricted `anon` table access was granted; the shared metadata tables remain stand-ins with actual application Storage RLS policies from migration `0004`. The test is **not** a genuine Supabase Storage HTTP binary upload/download, MIME validation, signed URL or object content retrieval.
- [x] Extended disposable `isolated-gotrue-auth` CI with **PostgreSQL custom-format backup and restore into a second ephemeral database**. `tests/restored_auth_storage_metadata.sql` verifies real GoTrue `auth.users`, Owner FK, draft + revision, audit records, private Storage bucket/object metadata and RLS policies survive. `tests/gotrue-restored-login.mjs` logs into a second GoTrue instance backed by the restored database: Owner/Non-Owner passwords work, invalid password fails.
- [x] The database dump is stored only in the temporary GitHub Actions runner directory and deleted on success; no uploaded artifact, hosted environment or private data is involved. These tests use synthetic accounts and object metadata only.
- [x] [GitHub Actions #41781753980](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41781753980) passed GoTrue JWT Storage metadata RLS; [#41782055443](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41782055443) passed the disposable Auth/Storage **database-metadata** restore and re-login test.
- [ ] Remaining gate: actual Supabase Storage API upload/read/delete of bytes, signed-URL access and policy enforcement within Storage service, file-byte backup and restore, actual Google OAuth flow, and Next.js end-to-end cookie handling. **Do not characterize metadata DR as full Storage DR.**
- [ ] No production change, paid resources, deployment, feature flags or merge into `main`.

## Real Supabase Storage API binary + signed URL + full-file recovery — 4 November 2026

- [x] Introduced an **isolated** GitHub Actions `isolated-storage-http` job using pinned official `supabase/storage-api:v1.81.0`, disposable PostgreSQL 17 and a local directory mounted as the file backend. The actual Storage service initializes and migrates its **real** `storage` schema. `tests/storage_api_real_schema.sql` then applies our unchanged migrations `0001`–`0006` and bootstraps only synthetic users and a synthetic Owner. No hosted project/keys, Google account, Cloudflare deployment or paid product is involved.
- [x] `tests/storage-api-http.mjs` tests actual binary PNG upload/download with SHA-256 equality, private bucket anonymous and Non-Owner denial, authenticated Owner GET, **time-limited signed URL creation and read**, and Non-Owner inability to sign or delete a private object.
- [x] Added a **two-part disaster recovery drill**: PostgreSQL custom-format dump **including grants/ACLs** and a separate filesystem-byte copy. Restores into a second disposable PostgreSQL database and an independently started second Storage API server bound to another file directory. `tests/storage-api-restored-http.mjs` re-reads the restored object byte-for-byte, generates/uses a fresh signed URL, and confirms Non-Owner/public reads and Non-Owner signing are still denied.
- [x] First restore run identified a real privilege loss: dumping/restoring with `--no-acl` silently broke Storage schema usage after recovery. The workflow now **preserves PostgreSQL GRANT ACLs** and tests that the restored service can actually read the bytes. Do not drop ACL restoration in a future backup design without explicit role/grant recreation.
- [x] [GitHub Actions #41782609716](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41782609716) passed the real Storage HTTP upload and signed URL test. [#41783017490](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41783017490) passed the **full isolated binary + metadata recovery and re-read** along with GoTrue, PostgREST, offline restore and Next.js/Cloudflare build checks.
- [ ] The Storage test signs synthetic local HS256 JWTs; the separate GoTrue+PostgREST test covers real GoTrue JWTs. A single combined **real GoTrue JWT → real Storage HTTP → RLS** test remains outstanding, as do Google OAuth, actual Next.js cookie routing and disaster recovery of a complete hosted Auth/Storage stack with its operational secrets.
- [ ] A temporary signed URL intentionally grants whoever holds that URL access until expiry. Production still requires server-side Owner authorization, minimum TTL, safe file/content validation, quota safeguards and an explicit release approval. No public production media or Publish feature has been enabled.
- [ ] Keep all hosted migrations `0005/0006` unapplied, flags default-off, no production writes, no merge to `main`, and total monthly paid-services budget at 0 THB.

## Real GoTrue-issued JWT → real Storage HTTP integration — 4 November 2026

- [x] Added `tests/gotrue-storage-http.mjs` and extended the isolated `isolated-storage-http` GitHub Actions job to launch pinned GoTrue v2.197.0 on a **separate, disposable PostgreSQL Auth database in the same CI runner**, after the existing Storage real-binary and disaster-recovery tests complete.
- [x] Registered Owner and Non-Owner test identities using the **actual GoTrue HTTP signup and password-login endpoints**, verified each token against `/user`, and used **GoTrue-issued signed access tokens**, not synthetic JWTs, against the already-running **actual Storage API v1.81.0** file HTTP endpoints. Both use the same CI-only signing secret.
- [x] Because this minimal isolated stack has two databases, a **privileged test-only bootstrap** inserts the GoTrue UUIDs into the Storage application database's synthetic `auth.users` and sets the test `owner_config` Owner identity. No such identity synchronization is a proposed production design; production uses Supabase's shared Auth database.
- [x] Verified real GoTrue Owner PNG upload, byte-identical authenticated and signed-URL downloads, Non-Owner/anonymous upload denial, private-bucket read denial, Non-Owner signing/deletion denial, and rejection of an access token with a corrupted HMAC signature. The prior separate real Storage file restore and re-read tests remain intact.
- [x] Initial CI discovered missing `role=authenticated` in the local GoTrue JWT when `GOTRUE_JWT_DEFAULT_GROUP_NAME` was omitted. Added the required setting to the isolated service environment; [GitHub Actions #41785792115](https://github.com/omegapiammani-collab/link-in-bio/actions/runs/41785792115) passed all jobs, including this integrated Storage test, GoTrue/PostgREST checks, PostgreSQL recovery and application/Cloudflare builds.
- [ ] Remaining acceptance: a unified real Supabase local stack with Auth and Storage sharing one database; browser-driven Google OAuth; actual Next.js SSR middleware/callback cookie flow; production media pipeline with strict size/type/signature checks and safe short-lived signed URLs. No claim of production readiness.
- [ ] All hosted migrations `0005/0006`, write flags, secrets, deployments and `main` remain untouched. All tests use isolated, ephemeral free GitHub Actions infrastructure only.
