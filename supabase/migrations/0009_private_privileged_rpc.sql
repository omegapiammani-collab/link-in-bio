-- Phase 2 RPC defense-in-depth, test environment only.
-- Keep privileged logic behind unexposed app_private schema. The public API
-- retains only SECURITY INVOKER wrappers, so PostgREST still offers the same
-- strict, audited contracts without publicly exposed definer functions.
--
-- This migration preserves all existing SQL bodies, validation, RLS checks,
-- owner checks, default-off release interlocks and current snapshots.
--
-- app_private is NOT included in Supabase exposed Data API schemas.
alter function public.publish_page_checked(uuid,bigint,boolean) set schema app_private;
alter function public.read_published_profile(text) set schema app_private;

-- Function ACLs survive SET SCHEMA, but revoke first and explicitly delegate.
revoke all on function app_private.publish_page_checked(uuid,bigint,boolean)
 from public, anon, authenticated;
revoke all on function app_private.read_published_profile(text)
 from public, anon, authenticated;

-- PostgREST's anon role must be allowed to invoke only the narrowly scoped
-- private reader (not select any private table or call privileged publishing).
-- Granting USAGE alone on a non-exposed schema does NOT grant table privileges.
grant usage on schema app_private to anon;
grant execute on function app_private.publish_page_checked(uuid,bigint,boolean)
 to authenticated;
grant execute on function app_private.read_published_profile(text)
 to anon, authenticated;

create function public.publish_page_checked(
 p_page_id uuid, p_expected_revision bigint, p_make_public boolean
) returns table(version_id uuid,version_number integer)
language sql security invoker set search_path = ''
as $wrapper$
 select * from app_private.publish_page_checked(
   p_page_id,p_expected_revision,p_make_public
 );
$wrapper$;

create function public.read_published_profile(p_slug text)
returns jsonb language sql stable security invoker set search_path = ''
as $wrapper$
 select app_private.read_published_profile(p_slug);
$wrapper$;

-- Never leave default PUBLIC EXECUTE grants on these API wrappers.
revoke all on function public.publish_page_checked(uuid,bigint,boolean)
 from public,anon,authenticated;
revoke all on function public.read_published_profile(text)
 from public,anon,authenticated;
grant execute on function public.publish_page_checked(uuid,bigint,boolean)
 to authenticated;
grant execute on function public.read_published_profile(text)
 to anon,authenticated;

-- Deliberately no updates to app_private.release_settings. Both OFF.
