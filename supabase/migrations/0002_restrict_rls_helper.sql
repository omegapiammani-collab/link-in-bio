-- Remove public API access to the existing DDL event-trigger helper.
-- Does not delete the event trigger or disable automatic RLS enforcement.
-- The helper returns event_trigger; it should only execute from PostgreSQL's
-- privileged DDL event trigger context, never from anon/authenticated REST calls.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
