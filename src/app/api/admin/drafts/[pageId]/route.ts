import { NextRequest, NextResponse } from 'next/server';
import { getOwner } from '@/lib/auth/owner';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isUuid, normalizeDraftDocument } from '@/lib/domain/draft-contract.mjs';
import { updateExistingDraftCas } from '@/lib/domain/draft-cas.mjs';

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
  if (declaredSize > 32768) return reply({ error: 'payload_too_large' }, 413);
  let raw: string;
  try { raw = await request.text(); }
  catch { return reply({ error: 'invalid_body' }, 400); }
  if (raw.length > 32768) return reply({ error: 'payload_too_large' }, 413);
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
  const result = await updateExistingDraftCas(db, pageId, expectedRevision, document);
  if (!result.ok) {
    return reply({ error: result.kind === 'conflict_or_missing' ? 'revision_conflict' : 'save_failed' },
      result.kind === 'conflict_or_missing' ? 409 : 500);
  }
  return reply({ revision: result.revision }, 200);
}
