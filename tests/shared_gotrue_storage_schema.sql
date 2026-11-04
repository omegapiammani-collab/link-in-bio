-- CI only: Storage API owns its actual storage.* schema, and GoTrue owns
-- auth.users + auth.uid() on the SAME disposable PostgreSQL database.
-- Neither identity stubs nor manual auth.users synchronization are allowed.
DO $assert$
BEGIN
  IF to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'real GoTrue and Storage schemas must both exist';
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'GoTrue auth.uid helper is absent';
  END IF;
END
$assert$;
DO $roles$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
   CREATE ROLE anon NOLOGIN;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
   CREATE ROLE authenticated NOLOGIN;
 END IF;
END
$roles$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
  LANGUAGE plpgsql AS $$ BEGIN NULL; END; $$;

\i /work/supabase/migrations/0001_initial_schema.sql
\i /work/supabase/migrations/0002_restrict_rls_helper.sql
\i /work/supabase/migrations/0003_foreign_key_indexes.sql
\i /work/supabase/migrations/0004_harden_publishing_audit_and_media.sql
\i /work/supabase/migrations/0005_audited_draft_transactions.sql
\i /work/supabase/migrations/0006_immutable_publish_core.sql

SELECT 'PASS: GoTrue Auth + Storage schema shared DB, real migrations 0001-0006' AS result;
