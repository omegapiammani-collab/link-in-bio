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
