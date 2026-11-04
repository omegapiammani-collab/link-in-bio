import { NextRequest, NextResponse } from 'next/server';
import { getOwner } from '@/lib/auth/owner';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isUuid, normalizeDraftDocument } from '@/lib/domain/draft-contract.mjs';

type Params = { params: Promise<{ pageId: string }> };
const noStore = { 'Cache-Control': 'no-store, private' };
function reply(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: noStore });
}
async function authorize(pageId: string) {
  if (process.env.PHASE2_DRAFT_WRITE_ENABLED !== 'true') return 404;
  if (!isUuid(pageId)) return 400;
  return await getOwner() ? 200 : 403;
}
export async function GET(_request: NextRequest, { params }: Params) {
  const { pageId } = await params;
  const access = await authorize(pageId);
  if (access !== 200) return reply({ error: 'unavailable' }, access);
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from('page_drafts')
    .select('profile_json,revision').eq('page_id', pageId).maybeSingle();
  if (error) return reply({ error: 'read_failed' }, 500);
  if (!data) return reply({ error: 'draft_not_found' }, 404);
  return reply({ document: data.profile_json, revision: data.revision }, 200);
}
export async function PATCH(request: NextRequest, { params }: Params) {
  const { pageId } = await params;
  const access = await authorize(pageId);
  if (access !== 200) return reply({ error: 'unavailable' }, access);
  // Cookie-bound mutations must originate from the same application origin.
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) return reply({ error: 'origin_forbidden' }, 403);
  const declaredSize = Number(request.headers.get('content-length') ?? 0);
  if (!Number.isFinite(declaredSize) || declaredSize < 0 || declaredSize > 32768) {
    return reply({ error: 'payload_too_large' }, 413);
  }
  let raw: string;
  try { raw = await request.text(); }
  catch { return reply({ error: 'invalid_body' }, 400); }
  if (new TextEncoder().encode(raw).length > 32768) {
    return reply({ error: 'payload_too_large' }, 413);
  }
  let body: unknown;
  try { body = JSON.parse(raw); }
  catch { return reply({ error: 'invalid_json' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'invalid_body' }, 400);
  const input = body as Record<string, unknown>;
  const expectedRevision = input.expectedRevision;
  if (typeof expectedRevision !== 'number' || !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 1 || expectedRevision >= Number.MAX_SAFE_INTEGER) {
    return reply({ error: 'revision_invalid' }, 422);
  }
  let document: ReturnType<typeof normalizeDraftDocument>;
  try { document = normalizeDraftDocument(input.document); }
  catch { return reply({ error: 'document_invalid' }, 422); }
  const db = await createSupabaseServerClient();
  // Stored procedure commits the revision update and its audit event atomically.
  // A failed audit INSERT rolls back the draft update as well.
  const { data, error } = await db.rpc('save_page_draft_audited', {
    p_page_id: pageId,
    p_expected_revision: expectedRevision,
    p_document: document
  });
  if (error) {
    if (error.code === 'P0001' && error.message === 'revision_conflict') {
      return reply({ error: 'revision_conflict' }, 409);
    }
    if (error.code === '42501') return reply({ error: 'forbidden' }, 403);
    return reply({ error: 'save_failed' }, 500);
  }
  if (data !== expectedRevision + 1) return reply({ error: 'invalid_server_response' }, 502);
  return reply({ revision: data }, 200);
}
