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
