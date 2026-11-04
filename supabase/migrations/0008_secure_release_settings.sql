-- Phase 2 test hardening. No public release is authorized by this migration.
-- The table is in an unexposed schema; RLS adds defense in depth even if
-- schema/table grants are accidentally broadened later.
--
-- Do NOT add anon/authenticated policies. The privileged SECURITY DEFINER
-- release functions, owned by postgres, retain their existing explicit
-- database-side OFF checks. A separate, audited release procedure is required
-- before any future attempt to flip these flags.
alter table app_private.release_settings enable row level security;
revoke all on table app_private.release_settings from public, anon, authenticated;

-- Deliberately no UPDATE, INSERT or DELETE to release_settings here.
-- Deliberately no changes to public RPC EXECUTE or to release switch values.
