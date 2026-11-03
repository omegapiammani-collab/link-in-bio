-- Phase 1: schema blueprint. Apply ONLY after reviewing project and owner bootstrap.
-- Owner UUID must correspond to an actual auth.users row after first Google sign-in.
create extension if not exists pgcrypto;

create table public.owner_config (
  singleton boolean primary key default true check(singleton),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Internal, unexposed schema for privileged ownership lookup.
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;
create or replace function app_private.is_owner() returns boolean
language sql stable security definer set search_path = ''
as $ select exists(select 1 from public.owner_config where auth_user_id=(select auth.uid())); $;
revoke all on function app_private.is_owner() from public, anon, authenticated;
grant execute on function app_private.is_owner() to authenticated;

create table public.pages (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique,
 visibility text not null default 'unlisted' check (visibility in ('public','unlisted')),
 status text not null default 'draft' check(status in ('draft','published','archived','trashed')),
 published_version_id uuid,
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint pages_slug_format check(slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'),
 constraint pages_reserved_slug check(lower(slug) not in ('admin','auth','api','login','en','_next','robots.txt','sitemap.xml','favicon.ico'))
);
create table public.page_drafts (
 page_id uuid primary key references public.pages(id) on delete cascade,
 profile_json jsonb not null default '{}'::jsonb,
 theme_json jsonb not null default '{}'::jsonb,
 socials_json jsonb not null default '{}'::jsonb,
 revision bigint not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
create table public.page_blocks (
 id uuid primary key default gen_random_uuid(),
 page_id uuid not null references public.pages(id) on delete cascade,
 type text not null check(type in ('link','header','divider','embed','image','text')),
 content_json jsonb not null default '{}'::jsonb,
 sort_order numeric(18,6) not null,
 is_active boolean not null default true,
 animation text not null default 'none' check(animation in ('none','bounce','shake','pulse','wobble')),
 schedule_start timestamptz,
 schedule_end timestamptz,
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 constraint block_window check(schedule_start is null or schedule_end is null or schedule_end>schedule_start)
);
create index page_blocks_order_idx on public.page_blocks(page_id,sort_order);
create table public.page_versions (
 id uuid primary key default gen_random_uuid(),
 page_id uuid not null references public.pages(id) on delete cascade,
 version_number integer not null check(version_number>0),
 snapshot_json jsonb not null,
 source_version_id uuid references public.page_versions(id) on delete set null,
 published_at timestamptz not null default now(),
 unique(page_id,version_number), unique(id,page_id)
);
alter table public.pages add constraint pages_published_version_fk
 foreign key(published_version_id,id) references public.page_versions(id,page_id) deferrable initially deferred;
create table public.slug_history (
 id uuid primary key default gen_random_uuid(),
 page_id uuid not null references public.pages(id) on delete cascade,
 old_slug text not null unique,
 created_at timestamptz not null default now(),
 constraint old_slug_format check(old_slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$')
);
create table public.media_assets (
 id uuid primary key default gen_random_uuid(),
 page_id uuid references public.pages(id) on delete set null,
 storage_path text not null unique,
 mime_type text not null,
 size_bytes bigint not null check(size_bytes>0),
 deleted_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.audit_events (
 id bigint generated always as identity primary key,
 actor_id uuid,
 event_type text not null,
 entity_type text,
 entity_id uuid,
 metadata_json jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events(created_at);
create table public.backup_manifests (
 id uuid primary key default gen_random_uuid(),
 backup_type text not null,
 storage_reference text not null,
 checksum text,
 created_at timestamptz not null default now(),
 verified_at timestamptz
);

-- Fail closed. No anonymous SELECT on base tables, including historic snapshots.
do $$ declare t text; begin
 foreach t in array array['owner_config','pages','page_drafts','page_blocks','page_versions','slug_history','media_assets','audit_events','backup_manifests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy owner_only on public.%I for all to authenticated using ((select app_private.is_owner())) with check ((select app_private.is_owner()))',t);
 end loop;
end $$;
drop policy owner_only on public.owner_config;
create policy owner_config_read on public.owner_config for select to authenticated using ((select app_private.is_owner()));
revoke insert,update,delete on public.owner_config from authenticated;

drop policy owner_only on public.page_versions;
create policy page_versions_owner_select on public.page_versions for select to authenticated using ((select app_private.is_owner()));
create policy page_versions_owner_insert on public.page_versions for insert to authenticated with check ((select app_private.is_owner()));
revoke update,delete on public.page_versions from authenticated;

drop policy owner_only on public.audit_events;
create policy audit_owner_read on public.audit_events for select to authenticated using ((select app_private.is_owner()));
create policy audit_owner_insert on public.audit_events for insert to authenticated with check ((select app_private.is_owner()));
revoke update,delete on public.audit_events from authenticated;
grant usage,select on sequence public.audit_events_id_seq to authenticated;

-- IMPORTANT: owner_config cannot be bootstrapped by the browser.
-- After Google OAuth login, use SQL Editor (privileged console) with the actual auth.users UUID:
-- insert into public.owner_config(singleton,auth_user_id) values(true,'YOUR_AUTH_USERS_UUID');
-- Keep OWNER_AUTH_USER_ID server environment variable identical to this UUID.
-- Public reads will be implemented in Phase 2 through a restricted public renderer.
