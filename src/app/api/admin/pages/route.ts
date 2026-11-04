import { NextRequest, NextResponse } from 'next/server';
import { getOwner } from '@/lib/auth/owner';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeDraftDocument } from '@/lib/domain/draft-contract.mjs';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
function reply(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers });
}
const RESERVED = new Set(['admin','auth','api','login','en','_next',
  'robots.txt','sitemap.xml','favicon.ico']);
function validSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 &&
    /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(value) && !RESERVED.has(value);
}

export async function POST(request: NextRequest) {
  // Both switches must be enabled only in a disposable, isolated test deployment.
  if (process.env.PHASE2_PAGE_CREATE_ENABLED !== 'true' ||
      process.env.PHASE2_DRAFT_WRITE_ENABLED !== 'true') return reply({ error: 'unavailable' }, 404);
  const owner = await getOwner();
  if (!owner) return reply({ error: 'forbidden' }, 403);
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return reply({ error: 'origin_forbidden' }, 403);
  }
  const size = Number(request.headers.get('content-length') ?? 0);
  if (!Number.isFinite(size) || size > 32768) return reply({ error: 'payload_too_large' }, 413);

  let input: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 32768) return reply({ error: 'payload_too_large' }, 413);
    input = JSON.parse(raw);
  } catch { return reply({ error: 'invalid_json' }, 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return reply({ error: 'invalid_body' }, 400);
  }
  const { slug, document } = input as Record<string, unknown>;
  if (!validSlug(slug)) return reply({ error: 'slug_invalid' }, 422);
  let normalized: ReturnType<typeof normalizeDraftDocument>;
  try { normalized = normalizeDraftDocument(document); }
  catch { return reply({ error: 'document_invalid' }, 422); }

  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc('create_page_draft_audited', {
    p_slug: slug, p_document: normalized
  }).single();
  if (error) {
    if (error.code === '23505') return reply({ error: 'slug_conflict' }, 409);
    if (error.code === '42501') return reply({ error: 'forbidden' }, 403);
    return reply({ error: 'create_failed' }, 500);
  }
  const result = data as { page_id?: unknown; revision?: unknown } | null;
  if (!result || typeof result.page_id !== 'string' || result.revision !== 1) {
    return reply({ error: 'invalid_server_response' }, 502);
  }
  return reply({ pageId: result.page_id, revision: 1 }, 201);
}

/** Owner-only page index. Disabled by default, read-only, never publishes drafts. */
export async function GET() {
  if (process.env.PHASE2_PAGE_LIST_ENABLED !== 'true') {
    return reply({ error: 'unavailable' }, 404);
  }
  if (!await getOwner()) return reply({ error: 'forbidden' }, 403);

  const db = await createSupabaseServerClient();
  const { data, error } = await db.from('pages')
    .select('id,slug,status,visibility,updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(50);
  if (error) return reply({ error: 'page_list_failed' }, 500);
  return reply({ pages: data ?? [], cappedAt: 50 }, 200);
}
