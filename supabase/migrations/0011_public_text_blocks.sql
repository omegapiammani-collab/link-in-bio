-- Read-only, deliberately narrow projection of published text-only blocks.
-- The raw snapshot, hidden blocks, schedules, media paths and HTML never
-- leave this RPC. The database clock decides schedule boundaries.
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
    ), '[]'::jsonb),
    'blocks', coalesce((
      select pg_catalog.jsonb_agg(
        case when entry.block->>'type' = 'divider' then
          pg_catalog.jsonb_build_object('id', entry.block->>'id', 'type', 'divider')
        else
          pg_catalog.jsonb_build_object(
            'id', entry.block->>'id',
            'type', entry.block->>'type',
            'text', case when entry.block->>'type' = 'header'
              then entry.block #>> '{content,title}'
              else entry.block #>> '{content,text}' end
          ) end
        order by entry.ordinality
      )
      from pg_catalog.jsonb_array_elements(
        coalesce(v.snapshot_json->'blocks', '[]'::jsonb)
      ) with ordinality as entry(block, ordinality)
      where entry.block->>'active' = 'true'
        and (entry.block->>'scheduleStart' is null or
          (entry.block->>'scheduleStart')::timestamptz <= now())
        and (entry.block->>'scheduleEnd' is null or
          now() < (entry.block->>'scheduleEnd')::timestamptz)
        and (
          entry.block->>'type' = 'divider'
          or (entry.block->>'type' = 'header'
            and pg_catalog.jsonb_typeof(entry.block #> '{content,title}') = 'string'
            and length(entry.block #>> '{content,title}') between 1 and 100)
          or (entry.block->>'type' = 'text'
            and pg_catalog.jsonb_typeof(entry.block #> '{content,text}') = 'string'
            and length(entry.block #>> '{content,text}') between 1 and 2000)
        )
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
