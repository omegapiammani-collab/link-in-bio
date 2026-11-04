-- Run after actual schema compatibility fixture, only in disposable PostgreSQL17.
\i /work/supabase/migrations/0006_immutable_publish_core.sql

-- SQL is intentionally private: even authenticated Owner cannot execute
-- this function through PostgREST or direct SQL credentials.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $test$
declare v_denied boolean:=false;
begin
  begin
    perform * from app_private.publish_draft_snapshot(
      (select id from public.pages where slug='compat-test'),2);
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'private publish was exposed to authenticated'; end if;
end;
$test$;
reset role;

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $test$
declare v_id uuid; v_first uuid; v_second uuid;
        v_num integer; v_rev bigint; v_denied boolean;
begin
  select id into v_id from public.pages where slug='compat-test';
  if v_id is null then raise exception 'missing real-schema fixture page'; end if;
  select version_id,version_number into v_first,v_num
    from app_private.publish_draft_snapshot(v_id,2);
  if v_num <> 1 or v_first is null then raise exception 'first publish did not succeed'; end if;
  if (select published_version_id from public.pages where id=v_id) is distinct from v_first
     or (select status from public.pages where id=v_id) <> 'published'
     or (select visibility from public.pages where id=v_id) <> 'unlisted' then
     raise exception 'atomic publish pointer/status/visibility mismatch';
  end if;
  if (select snapshot_json #>> '{profile,name}' from public.page_versions where id=v_first)
     <> 'Revised' then raise exception 'published snapshot is not saved draft'; end if;

  -- Stale expected revision must not create versions or Audit entries.
  v_denied:=false;
  begin
    perform * from app_private.publish_draft_snapshot(v_id,1);
  exception when raise_exception then v_denied:=true;
  end;
  if not v_denied then raise exception 'stale publish unexpectedly succeeded'; end if;
  if (select count(*) from public.page_versions where page_id=v_id)<>1
     or (select count(*) from public.audit_events where entity_id=v_id and
       event_type='page.published')<>1 then
    raise exception 'stale publish leaked version or audit';
  end if;

  -- Published draft can evolve without changing previously published snapshot.
  v_rev:=app_private.save_page_draft_audited(
    v_id,2,'{"name":"Fresh draft","description":"","links":[]}'::jsonb);
  if v_rev<>3 then raise exception 'save after publishing was rejected'; end if;
  if (select snapshot_json #>> '{profile,name}' from public.page_versions where id=v_first)
       <>'Revised' then raise exception 'old snapshot mutated on draft save'; end if;

  select version_id,version_number into v_second,v_num
    from app_private.publish_draft_snapshot(v_id,3);
  if v_num<>2 or v_second=v_first then raise exception 'republish did not version'; end if;
  if (select source_version_id from public.page_versions where id=v_second)
      is distinct from v_first then raise exception 'version ancestry missing'; end if;
  if (select snapshot_json #>> '{profile,name}' from public.page_versions where id=v_second)
      <>'Fresh draft' then raise exception 'republish failed to capture fresh draft'; end if;
  if (select published_version_id from public.pages where id=v_id)
       is distinct from v_second then raise exception 'active pointer mismatch'; end if;

  v_denied:=false;
  begin update public.page_versions set version_number=99 where id=v_first;
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'immutable trigger permitted UPDATE'; end if;
  v_denied:=false;
  begin delete from public.page_versions where id=v_first;
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'immutable trigger permitted DELETE'; end if;

  if (select count(*) from public.audit_events where entity_id=v_id and
       event_type='page.published')<>2 then raise exception 'publish audit missing'; end if;
end;
$test$;

-- Simulate audit INSERT fault; INSERT version + pointer UPDATE must roll back.
create function public.force_publish_audit_failure() returns trigger
language plpgsql set search_path=''
as $trigger$
begin
  if new.event_type='page.published' and
     current_setting('fixture.fail_publish_audit',true)='on' then
    raise exception 'forced_publish_audit_failure' using errcode='P0002';
  end if;
  return new;
end;
$trigger$;
create trigger force_publish_audit_failure
before insert on public.audit_events
for each row execute function public.force_publish_audit_failure();

do $test$
declare v_id uuid; v_before uuid; v_denied boolean:=false;
begin
  select id,published_version_id into v_id,v_before
    from public.pages where slug='compat-test';
  perform set_config('fixture.fail_publish_audit','on',false);
  begin perform * from app_private.publish_draft_snapshot(v_id,3);
  exception when others then v_denied:=true;
  end;
  perform set_config('fixture.fail_publish_audit','off',false);
  if not v_denied then raise exception 'audit failure did not reject publish'; end if;
  if (select published_version_id from public.pages where id=v_id)
       is distinct from v_before
     or (select count(*) from public.page_versions where page_id=v_id)<>2
     or (select count(*) from public.audit_events where entity_id=v_id and
       event_type='page.published')<>2 then
    raise exception 'audit failure did not roll back version/pointer';
  end if;
end;
$test$;

-- A synthetic non-owner still cannot execute private publish via privileged
-- test connection, because the SQL function independently checks auth.uid().
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $test$
declare v_denied boolean:=false;
begin
  begin
    perform * from app_private.publish_draft_snapshot(
      (select id from public.pages where slug='compat-test'),3);
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'non-owner publish succeeded'; end if;
end;
$test$;
-- Owner is authenticated but cannot fabricate immutable history or audit rows.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $test$
declare v_page uuid; v_denied_version boolean:=false; v_denied_audit boolean:=false;
begin
  select id into v_page from public.pages where slug='compat-test';
  begin
    insert into public.page_versions(page_id,version_number,snapshot_json)
    values(v_page,42,'{}'::jsonb);
  exception when insufficient_privilege then v_denied_version:=true;
  end;
  begin
    insert into public.audit_events(actor_id,event_type,entity_type,entity_id)
    values((select auth.uid()),'forged','page',v_page);
  exception when insufficient_privilege then v_denied_audit:=true;
  end;
  if not v_denied_version or not v_denied_audit then
    raise exception 'authenticated Owner bypassed version or audit transaction';
  end if;
end;
$test$;
reset role;

select 'PASS: private immutable publish, revision, ancestry, audit rollback, permissions' as result;
