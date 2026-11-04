# Phase 2 security hardening: private RLS and RPC review

**Scope:** Supabase test `hfsvnbbckfugrxugrnuc` only. Production `mmbhuxiejfqipttyujop` is unchanged. No Google OAuth setup, Cloudflare deployment, public release, or merge.

## Why migration 0008

A fresh Phase 2 test project accepted migrations 0001–0007, but the private singleton `app_private.release_settings` initially did not have RLS enabled. Its schema/table grants were already closed to `anon` and `authenticated`; enabling RLS without policies adds defense in depth. Migration `0008_secure_release_settings.sql` changes **only** RLS and ACL, not flag values.

The relevant Supabase advisory also flags deliberately privileged RPC entry points:
- `public.publish_page_checked(uuid,bigint,boolean)`: `SECURITY DEFINER` owner `postgres`; `EXECUTE` for authenticated only. It checks both private publish flag and verified `auth.uid()` against `owner_config` before publishing, and requires the revision to match.
- `public.read_published_profile(text)`: `SECURITY DEFINER` owner `postgres`; `EXECUTE` for `anon` and authenticated. It filters to immutable published versions of public, non-deleted pages and active links, only while private public-read switch is true. This privilege is intentional for future public profiles; its definer exposure requires continued review and negative tests.

Neither RPC should ever be considered secure merely because a web UI is gated: direct API invocation is the control boundary. Default OFF at the database and at the application are separate interlocks. Do not dismiss advisor warnings solely by disabling lint.

## Isolated test verification

- CI fixture `tests/staged_publication_fixture.sql` applies 0008 after 0007 and asserts RLS on, zero API policies, closed ACL, default OFF flags, denied anonymous publish, and null anonymous reader while OFF. Then it executes the existing staged Owner/NonOwner/public snapshot and immutable-version checks (only inside disposable CI PostgreSQL).
- The post-deployment test (only after CI success) must query `pg_class.relrowsecurity`, `pg_policies`, `pg_catalog.has_table_privilege`, `pg_catalog.has_function_privilege`, owner and pages counts, and OFF flags; run Supabase security advisor again.
- No actual external Google accounts are yet configured in the isolated test project. CI synthetic JWT and offline PostgreSQL negative tests are not a substitute for real Google OAuth / hosted PostgREST denial evidence.

## Follow-up warnings

Supabase Advisor may continue to warn about the intentionally callable `SECURITY DEFINER` publication and reader functions. Those warnings must be reviewed as an explicit risk/exception, and stronger proof of direct hosted RPC denial is required before public rollout. If changing them to `SECURITY INVOKER`/private wrappers, prove behavior with CI and **separately** approve subsequent hosted migrations.

The test project migration is not an approval to toggle `publish_enabled` or `public_read_enabled` from `false`. No paid tier is authorized.
