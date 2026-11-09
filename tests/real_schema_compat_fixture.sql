-- Real migration compatibility test using disposable PostgreSQL 17, no hosted DB.
-- Supabase-owned Auth/Storage prerequisites are simulated; all six application
-- migration SQL files are loaded unchanged. No Supabase HTTP service is involved.
-- PostgreSQL roles are cluster-wide and already exist from the preceding fixture.
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable set search_path=''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

\i /work/tests/isolated_supabase_prerequisites.sql
\i /work/supabase/migrations/0001_initial_schema.sql
\i /work/supabase/migrations/0002_restrict_rls_helper.sql
\i /work/supabase/migrations/0003_foreign_key_indexes.sql
\i /work/supabase/migrations/0004_harden_publishing_audit_and_media.sql
\i /work/supabase/migrations/0005_audited_draft_transactions.sql

-- Bootstrap exactly one real referenced Owner ID using privileged connection.
insert into auth.users (id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.owner_config (singleton, auth_user_id)
values (true, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

-- Real migration 0001 creates RLS. Ensure no accidental anonymous reads.
set role anon;
do $check$
declare denied boolean := false;
begin
 begin perform count(*) from public.pages;
 exception when insufficient_privilege then denied := true;
 end;
 if not denied then raise exception 'anonymous base page read unexpectedly allowed'; end if;
end;
$check$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
do $check$
declare v_id uuid; v_revision bigint; v_count integer;
begin
 select page_id,revision into v_id,v_revision
 from public.create_page_draft_audited('compat-test',
   '{"name":"Real baseline","description":"","links":[]}'::jsonb);
 if v_revision <> 1 then raise exception 'creation revision mismatch'; end if;
 if (select count(*) from public.pages where id=v_id and
      status='draft' and visibility='unlisted') <> 1 then
   raise exception 'created page incompatible with actual schema';
 end if;
 if (select count(*) from public.page_drafts where page_id=v_id and revision=1) <> 1 then
   raise exception 'draft row missing';
 end if;
 select public.save_page_draft_audited(v_id,1,
   '{"name":"Revised","description":"","links":[]}'::jsonb)
 into v_revision;
 if v_revision <> 2 then raise exception 'revision mismatch'; end if;
 if (select profile_json->>'name' from public.page_drafts where page_id=v_id) <> 'Revised' then
   raise exception 'save document mismatch';
 end if;
 select count(*) into v_count from public.audit_events where entity_id=v_id;
 if v_count <> 2 then raise exception 'audit transaction mismatch'; end if;
end;
$check$;

-- Authenticated Non-Owner cannot read under actual migration 0001 RLS.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false);
do $check$
declare denied boolean := false;
begin
 if (select count(*) from public.pages) <> 0 or
    (select count(*) from public.page_drafts) <> 0 or
    (select count(*) from public.audit_events) <> 0 then
    raise exception 'actual RLS leaks Owner data';
 end if;
 begin
   perform * from public.create_page_draft_audited('intruder',
     '{"name":"Denied","description":"","links":[]}'::jsonb);
 exception when insufficient_privilege then denied := true;
 end;
 if not denied then raise exception 'non-owner creation succeeded'; end if;
end;
$check$;
reset role;

-- Exercise real migration 0004 Storage policies using disposable stand-in
-- Storage tables. This checks PostgreSQL RLS only, not Storage HTTP.
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
do $storage$
declare v_id uuid; v_denied boolean:=false;
begin
 if not exists(select 1 from storage.buckets where id='link-in-bio-media'
    and public=false and file_size_limit=5242880
    and allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']::text[])
 then raise exception 'private media bucket migration mismatch'; end if;
 insert into storage.objects(bucket_id,name) values('link-in-bio-media','owner/photo.png')
 returning id into v_id;
 if not exists(select 1 from storage.objects where id=v_id) then
   raise exception 'owner storage RLS policy rejected access'; end if;
end;
$storage$;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false);
do $storage$
declare v_denied boolean:=false;
begin
 if (select count(*) from storage.objects) <> 0 then
   raise exception 'non-owner can list private media objects'; end if;
 begin
  insert into storage.objects(bucket_id,name) values('link-in-bio-media','intruder.png');
 exception when insufficient_privilege then v_denied:=true;
 end;
 if not v_denied then raise exception 'non-owner can insert media object'; end if;
end;
$storage$;
reset role;

select 'PASS: actual migrations 0001-0005, Owner draft CAS and Storage RLS' as result;
