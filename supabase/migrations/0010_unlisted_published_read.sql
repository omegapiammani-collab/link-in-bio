-- Baseline v1.1: an unlisted published page is readable by its exact URL.
-- Keep the private release switch, immutable snapshot, and base-table ACLs.
-- Apply to hosted environments only through a separately authorized rollout.
create or replace function app_private.read_published_profile(p_slug text)
returns jsonb language sql stable security definer set search_path = ''
as $read$
  select pg_catalog.jsonb_build_object(
    'slug', p.slug,
    'visibility', p.visibility,
    'name', v.snapshot_json #>> '{profile,name}',
    'description', v.snapshot_json #>> '{profile,description}',
    'links', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', entry.link->>'id',
          'title', entry.link->>'title',
          'url', entry.link->>'url',
          'active', true
        ) order by entry.ordinality
      )
      from pg_catalog.jsonb_array_elements(
        coalesce(v.snapshot_json #> '{profile,links}', '[]'::jsonb)
      ) with ordinality as entry(link, ordinality)
      where entry.link->>'active' = 'true'
    ), '[]'::jsonb)
  )
  from public.pages p
  inner join public.page_versions v
    on v.id = p.published_version_id and v.page_id = p.id
  where exists(select 1 from app_private.release_settings
      where singleton and public_read_enabled)
    and p_slug is not null and length(p_slug) between 1 and 64
    and p.slug = p_slug
    and p.status = 'published'
    and p.visibility in ('public', 'unlisted')
    and p.deleted_at is null
  limit 1;
$read$;
