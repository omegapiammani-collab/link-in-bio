-- CI ONLY: apply all application migrations beside the REAL GoTrue auth.users
-- and auth.uid() objects in one disposable PostgreSQL database.
-- No synthetic Auth users, no connection to hosted Supabase.
DO $roles$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
   CREATE ROLE anon NOLOGIN;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
   CREATE ROLE authenticated NOLOGIN;
 END IF;
END
$roles$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
\i /work/tests/isolated_supabase_prerequisites.sql
\i /work/supabase/migrations/0001_initial_schema.sql
\i /work/supabase/migrations/0002_restrict_rls_helper.sql
\i /work/supabase/migrations/0003_foreign_key_indexes.sql
\i /work/supabase/migrations/0004_harden_publishing_audit_and_media.sql
\i /work/supabase/migrations/0005_audited_draft_transactions.sql
\i /work/supabase/migrations/0006_immutable_publish_core.sql

-- Separate restricted PostgREST connection uses the SAME database as GoTrue.
CREATE ROLE authenticator WITH LOGIN NOINHERIT PASSWORD 'ci-disposable-postgrest-password';
GRANT anon, authenticated TO authenticator;
GRANT CONNECT ON DATABASE gotrue_ci TO authenticator;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
-- Do not grant publishing to either API role; do not override GoTrue's auth.uid().
SELECT 'PASS: real GoTrue auth.users and app migrations 0001-0006 in same database' as result;
