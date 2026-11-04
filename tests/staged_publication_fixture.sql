-- Run after the 0006 immutable publishing fixture on disposable PostgreSQL.
\i /work/supabase/migrations/0007_staged_publication.sql

-- Even an authenticated Owner cannot release anything with just the app
-- feature flag: the private database release switch defaults OFF.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $gate$
declare blocked boolean:=false;
begin
  begin
    perform * from public.publish_page_checked(
      (select id from public.pages where slug='compat-test'),3,true);
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'default-off publish interlock bypassed'; end if;
end;
$gate$;
reset role;
-- CI-only privileged approval: never mutate hosted settings without approval.
update app_private.release_settings
set publish_enabled=true, public_read_enabled=true where singleton;

-- Published but unlisted snapshots MUST NOT leak even via the public RPC.
set role anon;
do $check$
begin
  if public.read_published_profile('compat-test') is not null then
    raise exception 'unlisted snapshot leaked to anon';
  end if;
end;
$check$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $check$
declare blocked boolean:=false;
begin
  begin
    perform * from public.publish_page_checked(
      (select id from public.pages where slug='compat-test'),3,true);
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'non-Owner was allowed to publish'; end if;
end;
$check$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $check$
declare v_page uuid; v_id uuid; v_num integer; v_before integer;
        blocked boolean:=false;
begin
  select id into v_page from public.pages where slug='compat-test';
  select version_id,version_number into v_id,v_num
    from public.publish_page_checked(v_page,3,true);
  if v_id is null or v_num<>3 then raise exception 'audited public release mismatch'; end if;
  if (select visibility from public.pages where id=v_page)<>'public' then
    raise exception 'explicit publication did not set public visibility'; end if;

  v_before:=(select count(*) from public.page_versions where page_id=v_page);
  begin
    perform * from public.publish_page_checked(v_page,2,false);
  exception when raise_exception then blocked:=true;
  end;
  if not blocked or (select count(*) from public.page_versions where page_id=v_page)<>v_before
     or (select visibility from public.pages where id=v_page)<>'public' then
    raise exception 'stale release did not roll back';
  end if;
end;
$check$;
reset role;

set role anon;
do $check$
declare obj jsonb;
begin
  obj:=public.read_published_profile('compat-test');
  if obj->>'name'<>'Fresh draft' or obj->>'slug'<>'compat-test' then
    raise exception 'public reader did not read immutable version';
  end if;
  if (obj ? 'theme' or obj ? 'draftRevision' or obj ? 'audit_events'
      or obj ? 'blocks') then
    raise exception 'public reader leaked private snapshot metadata';
  end if;
  if public.read_published_profile('missing') is not null then
    raise exception 'unknown slug exposed';
  end if;
  -- Base tables must stay inaccessible, even after releasing one page.
  begin perform 1 from public.page_versions;
  exception when insufficient_privilege then return;
  end;
  raise exception 'anon can read immutable base table';
end;
$check$;
reset role;

-- Editing the next draft never changes the already published public data.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $check$
declare v_page uuid; v_rev bigint;
begin
  select id into v_page from public.pages where slug='compat-test';
  v_rev:=public.save_page_draft_audited(v_page,3,
    '{"name":"Never public draft","description":"","links":[]}'::jsonb);
  if v_rev<>4 then raise exception 'draft after public release failed'; end if;
end;
$check$;
reset role;
set role anon;
do $check$
begin
  if public.read_published_profile('compat-test')->>'name'<>'Fresh draft' then
    raise exception 'unpublished draft leaked through public reader';
  end if;
end;
$check$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $check$
declare v_page uuid; v_number int;
begin
  select id into v_page from public.pages where slug='compat-test';
  select version_number into v_number from public.publish_page_checked(v_page,4,false);
  if v_number<>4 then raise exception 'unlisted republish mismatch'; end if;
end;
$check$;
reset role;
set role anon;
do $check$
begin
  if public.read_published_profile('compat-test') is not null then
    raise exception 'unlisted republish did not remove public access';
  end if;
end;
$check$;
reset role;

-- Inactive links are confidential: the anonymous RPC itself must filter them.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $check$
declare v_page uuid; v_revision bigint; v_version integer;
begin
  select id into v_page from public.pages where slug='compat-test';
  v_revision:=public.save_page_draft_audited(v_page,4,
    '{"name":"Filtered","description":"","links":[{"id":"4d1c3998-c419-4f4f-8a01-f8c8a8b2bce9","title":"Private inactive","url":"https://private.example.com/secret","active":false},{"id":"6f15d9c5-58f9-43ed-ab50-44eb7c361ae7","title":"Public active","url":"https://example.com/","active":true}]}'::jsonb);
  if v_revision<>5 then raise exception 'media test draft save failed'; end if;
  select version_number into v_version from public.publish_page_checked(v_page,5,true);
  if v_version<>5 then raise exception 'filtered snapshot release failed'; end if;
end;
$check$;
reset role;
set role anon;
do $check$
declare payload jsonb;
begin
  payload:=public.read_published_profile('compat-test');
  if pg_catalog.jsonb_array_length(payload->'links')<>1 or
     payload #>> '{links,0,title}'<>'Public active' or
     payload::text like '%Private inactive%' or
     payload::text like '%private.example.com%' then
    raise exception 'anonymous RPC disclosed an inactive link';
  end if;
end;
$check$;
reset role;

-- Even if an existing page is marked public, an administrator may disable
-- public data access independently of the frontend feature flag.
update app_private.release_settings set public_read_enabled=false where singleton;
set role anon;
do $check$
begin
  if public.read_published_profile('compat-test') is not null then
    raise exception 'database reader interlock failed';
  end if;
end;
$check$;
reset role;

select 'PASS: immutable public release, unlisted privacy, Owner authorization, stale rollback, draft isolation' as result;
