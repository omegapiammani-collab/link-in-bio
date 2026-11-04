# Phase 2 security hardening: private RLS and RPC review

**Scope:** Supabase test `hfsvnbbckfugrxugrnuc` only. Production `mmbhuxiejfqipttyujop` is unchanged. No Google OAuth setup, Cloudflare deployment, public release, or merge.

## Why migration 0008

A fresh Phase 2 test project accepted migrations 0001–0007, but the private singleton `app_private.release_settings` initially did not have RLS enabled. Its schema/table grants were already closed to `anon` and `authenticated`; enabling RLS without policies adds defense in depth. Migration `0008_secure_release_settings.sql` changes **only** RLS and ACL, not flag values.

The relevant Supabase advisory also flags deliberately privileged RPC entry points:
- `public.publish_page_checked(uuid,bigint,boolean)`: `SECURITY DEFINER` owner `postgres`; `EXECUTE` for authenticated only. It checks both private publish flag and verified `auth.uid()` against `owner_config` before publishing, and requires the revision to match.
- `public.read_published_profile(text)`: `SECURITY DEFINER` owner `postgres`; `EXECUTE` for `anon` and authenticated. It filters to immutable published versions of public, non-deleted pages and active links, only while private public-read switch is true. This privilege is intentional for future public profiles; its definer exposure requires continued review and negative tests.

Neither RPC should ever be considered secure merely because a web UI is gated: direct API invocation is the control boundary. Default OFF at the database and at the application are separate interlocks. Do not dismiss advisor warnings solely by disabling lint.

## Migration 0009: exposed RPC contract with private implementation

The two privileged `public` functions may be invoked by non-owner clients under their narrow database gates, so their bodies must not remain public `SECURITY DEFINER` entry points. Migration `0009_private_privileged_rpc.sql` transfers the **same original privileged implementation bodies** to the unexposed `app_private` schema and installs `SECURITY INVOKER` wrappers in `public` with unchanged signatures. Only `authenticated` may execute the privileged private publisher; `anon` and `authenticated` may call the private reader (via `public` wrapper). Granting `anon` schema USAGE is intentional but grants no table privileges; `app_private` must remain excluded from exposed API schemas. All release flags remain OFF.

This addresses the public `SECURITY DEFINER` advisor warnings without replacing internal authorization or broadening underlying table access. CI must prove that direct public RPC calls continue their correct Owner/NonOwner/anonymous behavior and that no base tables become readable. If advisor warnings persist, do not dismiss them.

## Isolated test verification

- CI fixture `tests/staged_publication_fixture.sql` applies 0008 and 0009 after 0007 and asserts RLS on, zero API policies, closed ACL, default OFF flags, denied anonymous publish, and null anonymous reader while OFF. Then it executes the existing staged Owner/NonOwner/public snapshot and immutable-version checks (only inside disposable CI PostgreSQL).
- The post-deployment test (only after CI success) must query `pg_class.relrowsecurity`, `pg_policies`, `pg_catalog.has_table_privilege`, `pg_catalog.has_function_privilege`, owner and pages counts, and OFF flags; run Supabase security advisor again.
- No actual external Google accounts are yet configured in the isolated test project. CI synthetic JWT and offline PostgreSQL negative tests are not a substitute for real Google OAuth / hosted PostgREST denial evidence.

## Follow-up warnings

The underlying private `SECURITY DEFINER` implementations still require rigorous code review and hosted direct-RPC denial tests. The public wrappers are intended to resolve advisor warnings, but only a post-migration advisory scan can confirm that. Keep `app_private` excluded from exposed schemas, and never grant private table privileges to API roles.

The test project migration is not an approval to toggle `publish_enabled` or `public_read_enabled` from `false`. No paid tier is authorized.
