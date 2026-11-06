-- Append to disposable PG17 fixture, never execute against a hosted database.
-- PostgREST reads the signed JWT "sub" from the claims GUC; the earlier SQL
-- fixture sets the legacy claim GUC directly for its synthetic role tests.
create or replace function auth.uid() returns uuid
language sql stable set search_path = ''
as $uid$
  select coalesce(
    nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid,
    (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  );
$uid$;

create role authenticator with login noinherit password 'ci-disposable-postgrest-password';
grant anon, authenticated to authenticator;
grant connect on database postgres to authenticator;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- PostgREST needs to read schema metadata but must not receive direct write
-- permissions on the draft tables or privileged internal functions.
revoke insert, update, delete on public.pages, public.page_drafts from authenticated;
revoke all on public.pages, public.page_drafts, public.audit_events from anon;
