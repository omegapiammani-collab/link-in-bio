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
\i /work/supabase/migrations/0007_staged_publication.sql
\i /work/supabase/migrations/0008_secure_release_settings.sql
\i /work/supabase/migrations/0009_private_privileged_rpc.sql
\i /work/supabase/migrations/0010_unlisted_published_read.sql
-- Approve release switches in this throwaway CI database only.
update app_private.release_settings set publish_enabled=true,public_read_enabled=true where singleton;

-- The API connects with a limited authenticator role, not postgres.
DO $api$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN
   CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'ci-disposable-postgrest-password';
 END IF;
END
$api$;
-- Storage API may pre-create the role as NOLOGIN without a password.
-- Set a CI-only password and restricted connection properties explicitly.
ALTER ROLE authenticator WITH LOGIN NOINHERIT PASSWORD 'ci-disposable-postgrest-password';
GRANT anon,authenticated TO authenticator;
GRANT CONNECT ON DATABASE storage_http_ci TO authenticator;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
-- Do not expose the Storage schema through PostgREST in this shared test.
-- The real Storage API exclusively handles storage object operations.
SELECT 'PASS: GoTrue Auth + Storage schema shared DB, real migrations 0001-0006, PostgREST limited role' AS result;
