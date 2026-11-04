-- Phase 2 proposal ONLY. Never apply to the hosted project until isolated Owner/Non-Owner tests pass.
-- PostgreSQL transactions make page+draft+audit and draft CAS+audit all-or-nothing.
-- Privileged implementations are not in the exposed public API schema.
-- Validation also applies to direct RPC invocations.
create or replace function app_private.assert_draft_document(p_document jsonb)
returns void language plpgsql security invoker set search_path = ''
as $validation$
declare
  v_link jsonb;
  v_id text;
  v_url text;
  v_seen text[] := array[]::text[];
begin
  if p_document is null or pg_catalog.jsonb_typeof(p_document) <> 'object'
    or pg_catalog.jsonb_typeof(p_document->'name') <> 'string'
    or length(p_document->>'name') > 80 or length(btrim(p_document->>'name')) = 0
    or pg_catalog.jsonb_typeof(p_document->'description') <> 'string'
    or length(p_document->>'description') > 500
    or pg_catalog.jsonb_typeof(p_document->'links') <> 'array'
    or pg_catalog.jsonb_array_length(p_document->'links') > 20 then
    raise exception 'invalid_document' using errcode='22023';
  end if;
  for v_link in select value from pg_catalog.jsonb_array_elements(p_document->'links') loop
    if pg_catalog.jsonb_typeof(v_link) <> 'object'
      or pg_catalog.jsonb_typeof(v_link->'id') <> 'string'
      or pg_catalog.jsonb_typeof(v_link->'title') <> 'string'
      or pg_catalog.jsonb_typeof(v_link->'url') <> 'string'
      or pg_catalog.jsonb_typeof(v_link->'active') <> 'boolean' then
      raise exception 'invalid_link' using errcode='22023';
    end if;
    v_id := v_link->>'id';
    v_url := v_link->>'url';
    if v_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or v_id = any(v_seen)
      or length(btrim(v_link->>'title'))=0 or length(v_link->>'title')>100
      or length(v_url)>2048 or length(v_url)<8
      or v_url !~* '^https?://'
      or v_url ~ '[[:space:][:cntrl:]]'
      or v_url ~* '^https?://[^/?#]*@'
      or v_url ~* '^https?://(localhost|[^/?#]*\.(local|localhost|internal|test|invalid))([:/?#]|$)' then
      raise exception 'invalid_link' using errcode='22023';
    end if;
    v_seen := pg_catalog.array_append(v_seen,v_id);
  end loop;
end;
$validation$;

create or replace function app_private.create_page_draft_audited(p_slug text, p_document jsonb)
returns table(page_id uuid, revision bigint)
language plpgsql security definer set search_path = ''
as $$
declare v_page uuid;
begin
  if (select auth.uid()) is null or not (select app_private.is_owner()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_slug is null or length(p_slug)>64 or
     p_slug !~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$' or
     p_slug in ('admin','auth','api','login','en','_next','robots.txt','sitemap.xml','favicon.ico') then
    raise exception 'invalid_slug' using errcode = '22023';
  end if;
  perform app_private.assert_draft_document(p_document);
  insert into public.pages(slug, status, visibility) values (p_slug, 'draft', 'unlisted')
  returning id into v_page;
  insert into public.page_drafts(page_id, profile_json, revision) values (v_page, p_document, 1);
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, metadata_json)
  values ((select auth.uid()), 'page.created', 'page', v_page, pg_catalog.jsonb_build_object('revision',1));
  return query select v_page, 1::bigint;
end;
$$;

create or replace function app_private.save_page_draft_audited(
  p_page_id uuid, p_expected_revision bigint, p_document jsonb
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
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
    and exists(select 1 from public.pages p where p.id=d.page_id and p.deleted_at is null
      and p.status='draft')
  returning d.revision into v_revision;
  if v_revision is null then
    raise exception 'revision_conflict' using errcode = 'P0001';
  end if;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata_json)
  values ((select auth.uid()),'draft.saved','page',p_page_id,
    pg_catalog.jsonb_build_object('revision',v_revision));
  return v_revision;
end;
$$;

-- Exposed wrappers remain SECURITY INVOKER; internal implementations perform an
-- independent owner check. Direct SQL access to the private implementations
-- cannot bypass the owner check.
create or replace function public.create_page_draft_audited(p_slug text, p_document jsonb)
returns table(page_id uuid, revision bigint)
language sql security invoker set search_path = ''
as $$ select * from app_private.create_page_draft_audited(p_slug, p_document); $$;

create or replace function public.save_page_draft_audited(
  p_page_id uuid, p_expected_revision bigint, p_document jsonb
) returns bigint
language sql security invoker set search_path = ''
as $$ select app_private.save_page_draft_audited(p_page_id,p_expected_revision,p_document); $$;

revoke all on function app_private.create_page_draft_audited(text,jsonb) from public,anon,authenticated;
revoke all on function app_private.save_page_draft_audited(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function app_private.create_page_draft_audited(text,jsonb) to authenticated;
grant execute on function app_private.save_page_draft_audited(uuid,bigint,jsonb) to authenticated;
revoke all on function public.create_page_draft_audited(text,jsonb) from public,anon,authenticated;
revoke all on function public.save_page_draft_audited(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.create_page_draft_audited(text,jsonb) to authenticated;
grant execute on function public.save_page_draft_audited(uuid,bigint,jsonb) to authenticated;

-- After this migration, a browser Owner cannot bypass the audit trail using
-- direct PostgREST INSERT/UPDATE/DELETE on the two mutable draft tables.
-- SELECT remains owner-gated via existing RLS.
revoke insert, update, delete on public.pages from authenticated;
revoke insert, update, delete on public.page_drafts from authenticated;

revoke all on function app_private.assert_draft_document(jsonb) from public, anon, authenticated;
grant execute on function app_private.assert_draft_document(jsonb) to authenticated;
