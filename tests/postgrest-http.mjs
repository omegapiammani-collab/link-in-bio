// Disposable PostgREST HTTP integration test with locally signed synthetic JWTs.
// No login, credentials or network traffic to hosted Supabase.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const base = 'http://127.0.0.1:3000';
const secret = 'ci-only-postgrest-fixture-secret-at-least-32-chars';
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stranger = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const document = { name: 'Owner page', description: '', links: [] };
const changed = { name: 'Owner update', description: '', links: [] };
let count = 0;

function jwt(subject, role = 'authenticated') {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    role, sub: subject, aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 600
  });
  const signature = createHmac('sha256', secret).update(header + '.' + payload).digest('base64url');
  return header + '.' + payload + '.' + signature;
}

async function call(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { status: response.status, data };
}

function check(condition, message, response) {
  assert.ok(condition, message + ' (response: ' + JSON.stringify(response) + ')');
  count++;
}
const o = jwt(owner), s = jwt(stranger);
const create = (slug, token = o, doc = document) =>
  call('/rpc/create_page_draft_audited', {
    method: 'POST', token, body: { p_slug: slug, p_document: doc }
  });
const save = (id, revision, token = o, doc = changed) =>
  call('/rpc/save_page_draft_audited', {
    method: 'POST', token,
    body: { p_page_id: id, p_expected_revision: revision, p_document: doc }
  });

// Tests hit a locally running PostgREST instance directly; Next.js isn't involved.
const anonCreate = await create('anon-create', null);
check(anonCreate.status === 401 || anonCreate.status === 403,
  'unauthenticated REST RPC must be denied', anonCreate);
const nonOwnerCreate = await create('nonowner-create', s);
check(nonOwnerCreate.status === 403,
  'authenticated Non-Owner REST RPC must be forbidden', nonOwnerCreate);

const created = await create('http-owner-draft');
check(created.status >= 200 && created.status < 300 && Array.isArray(created.data) &&
  created.data.length === 1 && created.data[0].revision === 1,
'Owner should create a draft through PostgREST', created);
const id = created.data[0].page_id;
check(typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id),
  'created page must return its UUID', created);

const anonRead = await call('/page_drafts?select=page_id,revision');
check(anonRead.status === 401 || anonRead.status === 403,
  'anonymous base table read must be denied', anonRead);
const strangerRead = await call('/page_drafts?select=page_id,revision', { token: s });
check(strangerRead.status === 200 && Array.isArray(strangerRead.data) &&
  strangerRead.data.length === 0, 'non-Owner cannot read private drafts through RLS', strangerRead);
const ownerRead = await call('/page_drafts?select=page_id,revision', { token: o });
check(ownerRead.status === 200 && Array.isArray(ownerRead.data) &&
  ownerRead.data.some(row => row.page_id === id && row.revision === 1),
  'Owner should read its created draft through RLS', ownerRead);

const privatePageList = await call('/pages?select=id,slug,status,visibility,updated_at&deleted_at=is.null&order=updated_at.desc,id.asc&limit=50', { token: o });
check(privatePageList.status === 200 && Array.isArray(privatePageList.data) &&
  privatePageList.data.some(page => page.id === id && page.slug === 'http-owner-draft' &&
    page.status === 'draft' && page.visibility === 'unlisted'),
  'Owner can see draft metadata through RLS-protected page index', privatePageList);
const nonOwnerPageList = await call('/pages?select=id,slug,status,visibility,updated_at', { token: s });
check(nonOwnerPageList.status === 200 && Array.isArray(nonOwnerPageList.data) &&
  nonOwnerPageList.data.length === 0,
  'Non-Owner must not discover private page metadata', nonOwnerPageList);
const anonPageList = await call('/pages?select=id,slug');
check(anonPageList.status === 401 || anonPageList.status === 403,
  'anonymous clients cannot query the page index', anonPageList);

const nonOwnerSave = await save(id, 1, s);
check(nonOwnerSave.status === 403, 'Non-Owner cannot save Owner draft', nonOwnerSave);
const updated = await save(id, 1);
check(updated.status === 200 && updated.data === 2,
  'Owner should save next revision atomically', updated);
const stale = await save(id, 1);
check(stale.status >= 400,
  'stale revision must be rejected over HTTP', stale);

const illegalDirectUpdate = await call('/page_drafts?page_id=eq.' + id,
  { token: o, method: 'PATCH', body: { revision: 99 } });
check(illegalDirectUpdate.status === 403,
  'even Owner cannot bypass audit via direct table UPDATE', illegalDirectUpdate);

const ownerAudit = await call('/audit_events?select=event_type,entity_id', { token: o });
check(ownerAudit.status === 200 && Array.isArray(ownerAudit.data) &&
  ownerAudit.data.some(row => row.event_type === 'page.created' && row.entity_id === id) &&
  ownerAudit.data.some(row => row.event_type === 'draft.saved' && row.entity_id === id),
  'both audited mutations must persist', ownerAudit);
const strangerAudit = await call('/audit_events?select=event_type', { token: s });
check(strangerAudit.status === 200 && Array.isArray(strangerAudit.data) &&
  strangerAudit.data.length === 0, 'non-Owner cannot inspect audit trail', strangerAudit);

const duplicate = await create('http-owner-draft');
check(duplicate.status === 409,
  'duplicate slug must be rejected over HTTP', duplicate);

const fakeJwt = jwt(owner).slice(0, -1) + 'A';
const invalidJwt = await call('/page_drafts?select=revision', { token: fakeJwt });
check(invalidJwt.status === 401,
  'invalid JWT signature must be rejected', invalidJwt);

process.stdout.write('PASS: ' + count +
  ' isolated PostgREST JWT/RLS/RPC HTTP assertions (no hosted Supabase)\n');
