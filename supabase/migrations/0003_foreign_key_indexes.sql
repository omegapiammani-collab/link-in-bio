-- Phase 1: Add covering indexes for foreign-key relationships flagged by Supabase Advisor.
-- Non-destructive; existing unique and primary-key indexes stay unchanged.
create index if not exists media_assets_page_id_idx
 on public.media_assets (page_id);

create index if not exists page_versions_source_version_id_idx
 on public.page_versions (source_version_id);

create index if not exists pages_published_version_id_id_idx
 on public.pages (published_version_id, id);

create index if not exists slug_history_page_id_idx
 on public.slug_history (page_id);
