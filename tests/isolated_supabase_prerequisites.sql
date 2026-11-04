-- Emulate only Supabase-managed prerequisites missing from plain PostgreSQL.
-- This fixture does not represent a real Auth or Storage HTTP service.
-- Application migrations 0001 through 0006 are applied UNMODIFIED.
create schema if not exists storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null
);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
-- Legacy migration 0002 revokes this pre-existing Supabase DDL helper.
-- It is not part of application migration 0001.
create function public.rls_auto_enable() returns event_trigger
language plpgsql as $stub$ begin null; end; $stub$;
