-- Strictly disposable Storage API integration fixture.
-- The REAL Storage service creates and migrates storage.*; never substitute
-- hand-built metadata tables for this test. App SQL migrations load unchanged.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid
language sql stable set search_path=''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon nologin;
create role authenticated nologin;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create function public.rls_auto_enable() returns event_trigger
language plpgsql as $$ begin null; end; $$;

-- Real application migrations (1 through 6), including the REAL storage.objects
-- policies on Supabase-managed tables produced by the actual Storage API.
\i /work/supabase/migrations/0001_initial_schema.sql
\i /work/supabase/migrations/0002_restrict_rls_helper.sql
\i /work/supabase/migrations/0003_foreign_key_indexes.sql
\i /work/supabase/migrations/0004_harden_publishing_audit_and_media.sql
\i /work/supabase/migrations/0005_audited_draft_transactions.sql
\i /work/supabase/migrations/0006_immutable_publish_core.sql

insert into auth.users(id) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.owner_config(singleton,auth_user_id)
values(true,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

select 'PASS: actual Storage API schema plus migrations 0001-0006' as result;
