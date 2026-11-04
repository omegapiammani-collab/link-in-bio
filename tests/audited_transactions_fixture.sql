-- Disposable PostgreSQL 17 fixture ONLY: no hosted Supabase credentials.
create role authenticated nologin;
create role anon nologin;
create schema auth;
create schema app_private;
grant usage on schema auth, app_private to authenticated;
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;
grant execute on function auth.uid() to authenticated;

create table public.owner_config(auth_user_id uuid primary key);
insert into public.owner_config values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
create function app_private.is_owner() returns boolean
language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.owner_config where auth_user_id=(select auth.uid())); $$;
revoke all on function app_private.is_owner() from public,anon,authenticated;
grant execute on function app_private.is_owner() to authenticated;

create table public.pages(
 id uuid primary key default gen_random_uuid(),
 slug text unique not null, visibility text not null default 'unlisted',
 status text not null default 'draft', deleted_at timestamptz,
 updated_at timestamptz default now()
);
create table public.page_drafts(
 page_id uuid primary key references public.pages(id),
 profile_json jsonb not null, revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
create table public.audit_events(
 id bigint generated always as identity primary key,
 actor_id uuid, event_type text not null, entity_type text,
 entity_id uuid, metadata_json jsonb not null default '{}'::jsonb
);
grant select, insert, update, delete on public.pages,public.page_drafts to authenticated;
grant select on public.audit_events to authenticated;
-- Synthetic forced failure: prove the save and its audit entry roll back together.
create function public.fail_fixture_audit() returns trigger language plpgsql
as $audit$
begin
 if current_setting('fixture.fail_audit',true) = 'on' then
   raise exception 'forced audit failure' using errcode='P0002';
 end if;
 return new;
end;
$audit$;
create trigger fixture_fail_audit before insert on public.audit_events
for each row execute function public.fail_fixture_audit();

\i /work/supabase/migrations/0005_audited_draft_transactions.sql

set role authenticated;
-- Simulate JWT identity with local-only custom PostgreSQL setting.
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $test$
declare denied boolean := false;
begin
 begin
   perform * from public.create_page_draft_audited('deny-page',
     '{"name":"No","description":"","links":[]}'::jsonb);
 exception when insufficient_privilege then denied := true;
 end;
 if not denied then raise exception 'non-owner create unexpectedly succeeded'; end if;
end;
$test$;

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $test$
declare
  v_page uuid;
  v_revision bigint;
  v_denied boolean;
  v_count bigint;
begin
  select page_id, revision into v_page,v_revision from public.create_page_draft_audited(
    'test-page','{"name":"Test","description":"","links":[]}'::jsonb);
  if v_revision <> 1 then raise exception 'initial revision mismatch'; end if;
  select count(*) into v_count from public.audit_events where event_type='page.created';
  if v_count <> 1 then raise exception 'create audit missing'; end if;
  v_revision := public.save_page_draft_audited(v_page,1,
    '{"name":"Changed","description":"","links":[]}'::jsonb);
  if v_revision <> 2 then raise exception 'saved revision mismatch'; end if;
  v_denied := false;
  begin
    perform public.save_page_draft_audited(v_page,1,
      '{"name":"Stale","description":"","links":[]}'::jsonb);
  exception when raise_exception then v_denied := true;
  end;
  if not v_denied then raise exception 'stale revision succeeded'; end if;
  select count(*) into v_count from public.audit_events where event_type='draft.saved';
  if v_count <> 1 then raise exception 'conflict wrote an audit event'; end if;

  perform set_config('fixture.fail_audit','on',false);
  v_denied := false;
  begin
    perform public.save_page_draft_audited(v_page,2,
      '{"name":"Must rollback","description":"","links":[]}'::jsonb);
  exception when others then v_denied := true;
  end;
  perform set_config('fixture.fail_audit','off',false);
  if not v_denied then raise exception 'forced audit failure did not propagate'; end if;
  if (select revision from public.page_drafts where page_id=v_page)<>2 then
    raise exception 'revision persisted despite audit failure';
  end if;
  if (select profile_json->>'name' from public.page_drafts where page_id=v_page)<>'Changed' then
    raise exception 'document persisted despite audit failure';
  end if;
  v_denied := false;
  begin
    update public.page_drafts set revision=99 where page_id=v_page;
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'direct draft UPDATE was not revoked'; end if;
end;
$test$;

reset role;
set role anon;
do $test$
declare denied boolean:=false;
begin
 begin
   perform * from public.create_page_draft_audited('anon-page',
     '{"name":"Anon","description":"","links":[]}'::jsonb);
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied then raise exception 'anon execute unexpectedly succeeded'; end if;
end;
$test$;
reset role;
select 'PASS: isolated atomic Owner, non-Owner, CAS, audit rollback and role grants' as result;
