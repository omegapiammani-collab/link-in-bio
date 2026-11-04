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
