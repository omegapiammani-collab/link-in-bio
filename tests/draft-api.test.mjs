import test from 'node:test';
import assert from 'node:assert/strict';
import { loadExistingDraft, saveExistingDraft, DraftRequestError } from '../src/lib/domain/draft-api.mjs';

const pageId = 'd50ebcde-70cf-4e98-9efe-72e467975364';
const linkId = 'aecb8498-4ac6-4d9c-bb71-48c249cce516';
const document = { name: 'หน้าแรก', description: 'รายละเอียด', links: [
  { id: linkId, title: 'เว็บไซต์', url: 'https://example.org', active: true }
] };
const json = (status, value) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

test('read existing owner draft validates revision and document', async () => {
  const fetcher = async (url, options) => {
    assert.equal(url, '/api/admin/drafts/' + pageId);
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    return json(200, { document, revision: 3 });
  };
  assert.deepEqual(await loadExistingDraft(fetcher, pageId), { document, revision: 3 });
});

test('save uses exact CAS revision and returns incremented revision', async () => {
  const fetcher = async (url, options) => {
    assert.equal(url, '/api/admin/drafts/' + pageId);
    assert.equal(options.method, 'PATCH');
    assert.equal(options.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(options.body), { expectedRevision: 3, document });
    return json(200, { revision: 4 });
  };
  assert.deepEqual(await saveExistingDraft(fetcher, pageId, 3, document), { document, revision: 4 });
});

test('stale revision is an explicit 409 conflict, not a successful save', async () => {
  await assert.rejects(
    () => saveExistingDraft(async () => json(409, { error: 'revision_conflict' }), pageId, 3, document),
    e => e instanceof DraftRequestError && e.status === 409 && e.code === 'revision_conflict'
  );
});

test('never submit malformed documents, revisions or IDs', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return json(200, { revision: 2 }); };
  await assert.rejects(() => saveExistingDraft(fetcher, pageId, 0, document), /revision_invalid/);
  await assert.rejects(() => saveExistingDraft(fetcher, 'invalid-id', 1, document), /page_id_invalid/);
  await assert.rejects(() => saveExistingDraft(fetcher, pageId, 1, { ...document, name: '' }), /profile_name_invalid/);
  assert.equal(calls, 0);
});

test('reject malformed server success, without accepting fake saves', async () => {
  await assert.rejects(() => loadExistingDraft(async () => json(200, { revision: 1, document: {} }), pageId),
    /invalid_server_document/);
  await assert.rejects(() => loadExistingDraft(async () => json(200, { revision: 0, document }), pageId),
    /invalid_revision/);
  await assert.rejects(() => saveExistingDraft(async () => json(200, { revision: 9 }), pageId, 1, document),
    /invalid_revision/);
});

test('disabled route produces a reported failure', async () => {
  await assert.rejects(
    () => loadExistingDraft(async () => json(404, { error: 'unavailable' }), pageId),
    e => e instanceof DraftRequestError && e.status === 404
  );
});
