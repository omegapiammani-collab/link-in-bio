import { isUuid, normalizeDraftDocument } from './draft-contract.mjs';

function endpoint(pageId) {
  if (!isUuid(pageId)) throw new Error('page_id_invalid');
  return '/api/admin/drafts/' + encodeURIComponent(pageId);
}

export class DraftRequestError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'DraftRequestError';
    this.code = code;
    this.status = status;
  }
}

async function readJson(response) {
  try { return await response.json(); }
  catch { throw new DraftRequestError('invalid_server_response', 502); }
}

export async function loadExistingDraft(fetcher, pageId, signal) {
  const response = await fetcher(endpoint(pageId), {
    method: 'GET', credentials: 'same-origin', cache: 'no-store', signal
  });
  const body = await readJson(response);
  if (!response.ok) throw new DraftRequestError(body?.error || 'load_failed', response.status);
  if (!Number.isSafeInteger(body?.revision) || body.revision < 1) {
    throw new DraftRequestError('invalid_revision', 502);
  }
  let document;
  try { document = normalizeDraftDocument(body.document); }
  catch { throw new DraftRequestError('invalid_server_document', 502); }
  return { document, revision: body.revision };
}

export async function saveExistingDraft(fetcher, pageId, expectedRevision, document, signal) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 ||
      expectedRevision >= Number.MAX_SAFE_INTEGER) throw new Error('revision_invalid');
  const safeDocument = normalizeDraftDocument(document);
  const response = await fetcher(endpoint(pageId), {
    method: 'PATCH',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedRevision, document: safeDocument }),
    signal
  });
  const body = await readJson(response);
  if (!response.ok) throw new DraftRequestError(body?.error || 'save_failed', response.status);
  if (body?.revision !== expectedRevision + 1) {
    throw new DraftRequestError('invalid_revision', 502);
  }
  return { document: safeDocument, revision: body.revision };
}
