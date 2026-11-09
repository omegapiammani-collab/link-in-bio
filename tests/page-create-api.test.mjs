import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewDraftPage, DraftRequestError } from '../src/lib/domain/draft-api.mjs';

const id = 'aecb8498-4ac6-4d9c-bb71-48c249cce516';
const document = { name: 'ตัวอย่าง', description: '', links: [] };
const json = (status, value) => ({
  status, ok: status >= 200 && status < 300, json: async () => value
});

test('create uses same-origin authenticated request with validated draft', async () => {
  const response = await createNewDraftPage(async (url, opts) => {
    assert.equal(url, '/api/admin/pages');
    assert.equal(opts.method, 'POST');
    assert.equal(opts.credentials, 'same-origin');
    assert.equal(opts.cache, 'no-store');
    assert.deepEqual(JSON.parse(opts.body), { slug: 'my-page', document });
    return json(201, { pageId: id, revision: 1 });
  }, 'my-page', document);
  assert.deepEqual(response, { pageId: id, revision: 1 });
});

test('reserved and malformed slugs fail before sending network request', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return json(201, { pageId: id, revision: 1 }); };
  for (const slug of ['admin', 'my page', '../admin', 'UPPER', 'a'.repeat(65), '-start', 'end-', '']) {
    await assert.rejects(() => createNewDraftPage(fetcher, slug, document), /slug_invalid/);
  }
  await assert.rejects(() => createNewDraftPage(fetcher, 'valid-page', { ...document, name: '' }),
    /profile_name_invalid/);
  assert.equal(calls, 0);
});

test('conflict and disabled server route are explicit failures', async () => {
  await assert.rejects(
    () => createNewDraftPage(async () => json(409, { error: 'slug_conflict' }), 'test-page', document),
    e => e instanceof DraftRequestError && e.status === 409 && e.code === 'slug_conflict'
  );
  await assert.rejects(
    () => createNewDraftPage(async () => json(404, { error: 'unavailable' }), 'test-page', document),
    e => e instanceof DraftRequestError && e.status === 404
  );
});

test('invalid success response never counts as created page', async () => {
  await assert.rejects(
    () => createNewDraftPage(async () => json(201, { pageId: 'bad-id', revision: 1 }), 'test-page', document),
    /invalid_server_response/
  );
  await assert.rejects(
    () => createNewDraftPage(async () => json(200, { pageId: id, revision: 1 }), 'test-page', document),
    /invalid_server_response/
  );
});
