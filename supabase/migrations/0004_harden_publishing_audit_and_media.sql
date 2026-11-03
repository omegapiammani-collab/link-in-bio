-- Phase 1 security hardening: keep publishing and audit recording server-controlled.
-- Phase 1 app implements authentication only. No client may create immutable
-- published snapshots, tamper with audit events, or forge backup manifests.
-- A later versioned, privileged publishing/backup workflow must explicitly grant
-- the minimum access it needs through an audited, server-controlled transaction.
revoke insert, update, delete on public.page_versions from authenticated;
drop policy if exists page_versions_owner_insert on public.page_versions;

revoke insert, update, delete on public.audit_events from authenticated;
drop policy if exists audit_owner_insert on public.audit_events;
revoke usage, select on sequence public.audit_events_id_seq from authenticated;

revoke insert, update, delete on public.backup_manifests from authenticated;
drop policy if exists owner_only on public.backup_manifests;
create policy backup_manifests_owner_read on public.backup_manifests
for select to authenticated using ((select app_private.is_owner()));

-- All media stays private. Public rendering will require narrowly scoped,
-- short-lived signed URLs built by the server in a later phase.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
 'link-in-bio-media', 'link-in-bio-media', false, 5242880,
 array['image/jpeg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do nothing;

create policy link_in_bio_media_owner_read on storage.objects
for select to authenticated using (
 bucket_id = 'link-in-bio-media' and (select app_private.is_owner())
);

create policy link_in_bio_media_owner_insert on storage.objects
for insert to authenticated with check (
 bucket_id = 'link-in-bio-media' and (select app_private.is_owner())
);

create policy link_in_bio_media_owner_update on storage.objects
for update to authenticated
using (bucket_id = 'link-in-bio-media' and (select app_private.is_owner()))
with check (bucket_id = 'link-in-bio-media' and (select app_private.is_owner()));

create policy link_in_bio_media_owner_delete on storage.objects
for delete to authenticated using (
 bucket_id = 'link-in-bio-media' and (select app_private.is_owner())
);
