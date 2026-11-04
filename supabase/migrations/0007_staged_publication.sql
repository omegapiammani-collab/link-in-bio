-- STAGED PHASE 2: audited, Owner-controlled publication + narrowly scoped
-- anonymous immutable snapshot reader. DO NOT apply to hosted Supabase until
-- release authorization; CI uses an ephemeral database only.
--
-- Explicit publication sets visibility. No direct client table UPDATE or
-- SELECT on page_versions or page_drafts is granted to anon.
-- Database-side release interlock: no client-controlled app flag can turn
-- on publishing or the public reader if this migration is merely staged.
-- Both are OFF unless an administrator explicitly updates this private row.
create table if not exists app_private.release_settings (
  singleton boolean primary key default true check(singleton),
  publish_enabled boolean not null default false,
  public_read_enabled boolean not null default false
);
insert into app_private.release_settings(singleton,publish_enabled,public_read_enabled)
values(true,false,false) on conflict(singleton) do nothing;
revoke all on app_private.release_settings from public,anon,authenticated;

create or replace function public.publish_page_checked(
  p_page_id uuid, p_expected_revision bigint, p_make_public boolean
) returns table(version_id uuid,version_number integer)
language plpgsql security definer set search_path=''
as $release$
declare
  v_id uuid;
  v_number integer;
begin
  if not exists(select 1 from app_private.release_settings
       where singleton and publish_enabled) then
    raise exception 'release_disabled' using errcode='42501';
  end if;
  if (select auth.uid()) is null or not (select app_private.is_owner()) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_page_id is null or p_expected_revision is null or
    p_expected_revision < 1 or p_make_public is null then
    raise exception 'invalid_publish_input' using errcode='22023';
  end if;

  -- The inner function locks page and draft, validates the exact revision,
  -- inserts the immutable version, advances the pointer and appends audit.
  select published.version_id,published.version_number
    into v_id,v_number
    from app_private.publish_draft_snapshot(p_page_id,p_expected_revision) published;

  if v_id is null then
    raise exception 'publish_failed' using errcode='P0001';
  end if;
  -- Explicitly requested visibility is atomic with snapshot creation.
  update public.pages
    set visibility=case when p_make_public then 'public' else 'unlisted' end
    where id=p_page_id and published_version_id=v_id;
  if not found then
    raise exception 'publish_pointer_mismatch' using errcode='P0001';
  end if;
  insert into public.audit_events(
    actor_id,event_type,entity_type,entity_id,metadata_json
  ) values ((select auth.uid()),'page.visibility_changed','page',p_page_id,
    pg_catalog.jsonb_build_object('versionId',v_id,'visibility',
      case when p_make_public then 'public' else 'unlisted' end));
  return query select v_id,v_number;
end;
$release$;

-- Public RPC reveals ONLY profile data from a selected, immutable snapshot.
-- No draft, audit, private media path, raw block or internal table metadata.
-- Inactive links are filtered by the UI; no stored HTML is executed.
create or replace function public.read_published_profile(p_slug text)
returns jsonb language sql stable security definer set search_path=''
as $read$
  select pg_catalog.jsonb_build_object(
    'slug', p.slug,
    'name', v.snapshot_json #>> '{profile,name}',
    'description', v.snapshot_json #>> '{profile,description}',
    'links', coalesce(v.snapshot_json #> '{profile,links}','[]'::jsonb)
  )
  from public.pages p
  inner join public.page_versions v
    on v.id=p.published_version_id and v.page_id=p.id
  where exists(select 1 from app_private.release_settings
      where singleton and public_read_enabled)
    and p_slug is not null and length(p_slug) between 1 and 64
    and p.slug=p_slug
    and p.status='published'
    and p.visibility='public'
    and p.deleted_at is null
  limit 1;
$read$;

revoke all on function public.publish_page_checked(uuid,bigint,boolean) from public,anon;
grant execute on function public.publish_page_checked(uuid,bigint,boolean) to authenticated;
revoke all on function public.read_published_profile(text) from public,anon,authenticated;
grant execute on function public.read_published_profile(text) to anon,authenticated;
-- Inner function stays private and unexposed to PostgREST clients.
-- Keep app_private.publish_draft_snapshot() revoked from both API roles.
