-- Restrict the legacy RLS DDL event-trigger helper if present.
-- New Supabase projects do not necessarily have this Phase 1 helper; never
-- create it just to revoke privileges. Existing projects keep their trigger.
do $guard$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$guard$;
