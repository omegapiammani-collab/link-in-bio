-- PROPOSAL ONLY: immutable publish core, intentionally not reachable from PostgREST.
-- No public RPC wrapper and no EXECUTE for anon/authenticated. Never apply to
-- hosted Supabase until isolated Auth/Storage DR and publishing approval.
--
-- Lock order: page, draft. The version pointer, immutable snapshot and audit
-- event are committed by a single PostgreSQL function call/transaction.
create or replace function app_private.publish_draft_snapshot(
  p_page_id uuid, p_expected_revision bigint
) returns table(version_id uuid, version_number integer)
language plpgsql security definer set search_path = ''
as $publish$
declare
  v_page public.pages%rowtype;
  v_draft public.page_drafts%rowtype;
  v_last_version integer;
  v_id uuid;
  v_num integer;
  v_snapshot jsonb;
  v_blocks jsonb;
begin
  if (select auth.uid()) is null or not (select app_private.is_owner()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_page_id is null or p_expected_revision is null or
     p_expected_revision < 1 then
    raise exception 'invalid_revision' using errcode = '22023';
  end if;
  select * into v_page from public.pages
   where id = p_page_id and deleted_at is null
     and status in ('draft','published')
   for update;
  if not found then
    raise exception 'page_not_publishable' using errcode = 'P0001';
  end if;
  select * into v_draft from public.page_drafts
   where page_id = p_page_id for update;
  if not found or v_draft.revision <> p_expected_revision then
    raise exception 'revision_conflict' using errcode = 'P0001';
  end if;
  perform app_private.assert_draft_document(v_draft.profile_json);
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', b.id, 'type', b.type, 'content', b.content_json,
      'active', b.is_active, 'sortOrder', b.sort_order,
      'animation', b.animation, 'scheduleStart', b.schedule_start,
      'scheduleEnd', b.schedule_end
    ) order by b.sort_order, b.id
  ), '[]'::jsonb) into v_blocks
  from public.page_blocks b
  where b.page_id = p_page_id and b.deleted_at is null;

  select coalesce(max(existing.version_number),0)
    into v_last_version from public.page_versions existing where existing.page_id=p_page_id;
  if v_last_version >= 2147483647 then
    raise exception 'version_limit' using errcode='22023';
  end if;
  v_num := v_last_version + 1;
  v_snapshot := pg_catalog.jsonb_build_object(
    'schemaVersion', 1, 'draftRevision', v_draft.revision,
    'profile', v_draft.profile_json, 'theme', v_draft.theme_json,
    'socials', v_draft.socials_json, 'blocks', v_blocks
  );
  insert into public.page_versions(
    page_id,version_number,snapshot_json,source_version_id
  ) values (p_page_id,v_num,v_snapshot,v_page.published_version_id)
  returning id into v_id;
  -- Preserve unlisted visibility; a public renderer and release flag do not
  -- exist yet. Merely marking published must NEVER expose a public route.
  update public.pages
    set published_version_id=v_id, status='published', updated_at=now()
  where id=p_page_id;
  insert into public.audit_events(
    actor_id,event_type,entity_type,entity_id,metadata_json
  ) values (
    (select auth.uid()),'page.published','page',p_page_id,
    pg_catalog.jsonb_build_object(
      'versionId',v_id,'versionNumber',v_num,'draftRevision',v_draft.revision
    )
  );
  return query select v_id,v_num;
end;
$publish$;

-- Existing draft content can be edited after publishing, then republished as
-- a separate immutable snapshot. The active snapshot does not change on save.
create or replace function app_private.save_page_draft_audited(
  p_page_id uuid, p_expected_revision bigint, p_document jsonb
) returns bigint
language plpgsql security definer set search_path = ''
as $save$
declare v_revision bigint;
begin
  if (select auth.uid()) is null or not (select app_private.is_owner()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_page_id is null or p_expected_revision is null or p_expected_revision < 1 or
     p_expected_revision >= 9223372036854775807 then
    raise exception 'invalid_revision' using errcode = '22023';
  end if;
  perform app_private.assert_draft_document(p_document);
  update public.page_drafts d
    set profile_json = p_document, revision = d.revision + 1, updated_at = now()
  where d.page_id = p_page_id and d.revision = p_expected_revision
    and exists (select 1 from public.pages p where p.id=d.page_id
      and p.deleted_at is null and p.status in ('draft','published'))
  returning d.revision into v_revision;
  if v_revision is null then
    raise exception 'revision_conflict' using errcode = 'P0001';
  end if;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata_json)
  values ((select auth.uid()),'draft.saved','page',p_page_id,
    pg_catalog.jsonb_build_object('revision',v_revision));
  return v_revision;
end;
$save$;

-- Database-side immutability protects historical snapshots even against
-- accidentally re-granted UPDATE/DELETE privileges.
create or replace function app_private.reject_version_mutation()
returns trigger language plpgsql security definer set search_path = ''
as $immutable$
begin
  raise exception 'immutable_page_version' using errcode='42501';
end;
$immutable$;
create trigger page_versions_immutable
before update or delete on public.page_versions
for each row execute function app_private.reject_version_mutation();

revoke all on function app_private.publish_draft_snapshot(uuid,bigint)
  from public,anon,authenticated;
revoke all on function app_private.reject_version_mutation()
  from public,anon,authenticated;
-- No GRANT and NO public.publish_* RPC or UI. Tests call the private function
-- via a privileged *disposable* PostgreSQL connection only.

-- Only audited SECURITY DEFINER transactions may write versions or audit.
-- Migration 0001 originally allowed authenticated direct INSERT on both.
revoke insert on public.page_versions from authenticated;
revoke insert on public.audit_events from authenticated;
