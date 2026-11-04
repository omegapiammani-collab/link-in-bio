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
