// Actual Supabase Auth (GoTrue) HTTP integration against disposable Docker.
// No provider credentials, outbound sign-in, hosted Supabase or real users.
import assert from 'node:assert/strict';
import { createServerClient } from '@supabase/ssr';
import { verifyOwnerSession } from '../src/lib/auth/owner-policy.mjs';
import { execFileSync } from 'node:child_process';

const auth = 'http://127.0.0.1:9999';
const jwtSecret = 'ci-only-gotrue-jwt-secret-32-plus-chars';
const emailDomain = 'example.invalid';
const apiKey = 'sb_publishable_ci_disposable_not_real';
const isolatedFetch = async (input, init) => {
  const request = new URL(typeof input === 'string' ? input : input.url);
  assert.equal(request.hostname, '127.0.0.1', 'Auth SDK must not call external endpoints');
  assert.ok(request.pathname.startsWith('/auth/v1/'), 'unexpected SDK request path');
  const target = auth + request.pathname.slice('/auth/v1'.length) + request.search;
  return fetch(target, init);
};

function clientFixture() {
  const cookies = new Map();
  function client() {
    return createServerClient(auth, apiKey, {
      global: { fetch: isolatedFetch },
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: items => {
          for (const { name, value, options } of items) {
            if (options?.maxAge === 0 || !value) cookies.delete(name);
            else cookies.set(name, value);
          }
        }
      }
    });
  }
  return { client, cookies };
}
const ownerEmail = 'owner-ci@' + emailDomain;
const strangerEmail = 'nonowner-ci@' + emailDomain;
const password = 'ci-only-ValidPassword-123456!';
async function register(email) {
  const response = await fetch(auth + '/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  assert.equal(response.status, 200, 'real GoTrue signup failed: ' + JSON.stringify(data));
  assert.match(data.user?.id ?? '', /^[0-9a-f-]{36}$/i);
  return data.user.id;
}

const ownerId = await register(ownerEmail);
const nonOwnerId = await register(strangerEmail);
assert.notEqual(ownerId, nonOwnerId);
// Bootstrapping owner_config must be privileged and must reference the real
// GoTrue auth.users row. Never attempt Owner bootstrap through browser/RPC.
assert.match(ownerId, /^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
execFileSync('docker', [
  'run', '--rm', '--network', 'host',
  '-e', 'PGPASSWORD=ci-only-local-password',
  'postgres:17', 'psql',
  '-h', '127.0.0.1', '-U', 'postgres', '-d', 'gotrue_ci',
  '-v', 'ON_ERROR_STOP=1',
  '-c', "INSERT INTO public.owner_config(singleton, auth_user_id) VALUES(true, '" +
    ownerId + "'::uuid)"
], { stdio: 'pipe' });

const rest = 'http://127.0.0.1:3000';
async function dataApi(route, { token, method = 'GET', body } = {}) {
  const response = await fetch(rest + route, {
    method,
    headers: {
      accept: 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: response.status, data };
}
const draft = { name: 'Real GoTrue Owner', description: '', links: [] };

const owner = clientFixture();
const login = await owner.client().auth.signInWithPassword({
  email: ownerEmail, password
});
assert.equal(login.error, null, 'real GoTrue Owner password login failed');
assert.equal(login.data.user?.id, ownerId);
assert.ok(owner.cookies.size > 0, 'Supabase SSR must persist the GoTrue session in cookies');
assert.equal((await verifyOwnerSession(owner.client(), ownerId))?.id, ownerId,
  'verified server Auth session should authorize Owner');
assert.equal(await verifyOwnerSession(owner.client(), nonOwnerId), null,
  'Owner JWT must not authorize a different configured UUID');

const foreign = clientFixture();
const foreignLogin = await foreign.client().auth.signInWithPassword({
  email: strangerEmail, password
});
assert.equal(foreignLogin.error, null);
assert.equal(foreignLogin.data.user?.id, nonOwnerId);
assert.equal(await verifyOwnerSession(foreign.client(), ownerId), null,
  'Non-Owner GoTrue session must not be authorized');

// Use actual JWTs issued by GoTrue, never handcrafted fixture signatures.
// All requests below run over HTTP to PostgREST using real application RLS.
const ownerJwt = login.data.session?.access_token;
const otherJwt = foreignLogin.data.session?.access_token;
assert.ok(ownerJwt && otherJwt, 'must obtain signed real GoTrue access tokens');
const ownerClaims = JSON.parse(Buffer.from(ownerJwt.split('.')[1], 'base64url').toString('utf8'));
assert.equal(ownerClaims.sub, ownerId);
assert.equal(ownerClaims.role, 'authenticated');
const noTokenCreate = await dataApi('/rpc/create_page_draft_audited', {
  method: 'POST', body: { p_slug: 'real-gotrue-anon', p_document: draft }
});
assert.ok([401,403].includes(noTokenCreate.status), JSON.stringify(noTokenCreate));

const nonOwnerCreate = await dataApi('/rpc/create_page_draft_audited', {
  method: 'POST', token: otherJwt, body: { p_slug: 'real-gotrue-stranger', p_document: draft }
});
assert.equal(nonOwnerCreate.status, 403, JSON.stringify(nonOwnerCreate));

const created = await dataApi('/rpc/create_page_draft_audited', {
  method: 'POST', token: ownerJwt, body: { p_slug: 'real-gotrue-owner', p_document: draft }
});
assert.ok(created.status >= 200 && created.status < 300 &&
  Array.isArray(created.data) && created.data.length === 1 &&
  created.data[0].revision === 1, JSON.stringify(created));
const pageId = created.data[0].page_id;
assert.match(pageId, /^[0-9a-f-]{36}$/i);

const ownerRows = await dataApi('/page_drafts?select=page_id,revision', { token: ownerJwt });
assert.equal(ownerRows.status, 200, JSON.stringify(ownerRows));
assert.ok(ownerRows.data.some(row => row.page_id === pageId), JSON.stringify(ownerRows));

const strangerRows = await dataApi('/page_drafts?select=page_id,revision', { token: otherJwt });
assert.equal(strangerRows.status, 200, JSON.stringify(strangerRows));
assert.ok(!strangerRows.data.some(row => row.page_id === pageId), 'Non-Owner RLS leaked draft');

const forbiddenPatch = await dataApi('/page_drafts?page_id=eq.' + pageId, {
  token: ownerJwt, method: 'PATCH', body: { revision: 99 }
});
assert.equal(forbiddenPatch.status, 403, JSON.stringify(forbiddenPatch));

const saved = await dataApi('/rpc/save_page_draft_audited', {
  token: ownerJwt, method: 'POST',
  body: { p_page_id: pageId, p_expected_revision: 1,
    p_document: { ...draft, name: 'Real GoTrue Updated' } }
});
assert.equal(saved.status, 200, JSON.stringify(saved));
assert.equal(saved.data, 2);
const audit = await dataApi('/audit_events?select=event_type,entity_id', { token: ownerJwt });
assert.equal(audit.status, 200, JSON.stringify(audit));
assert.ok(audit.data.some(e => e.entity_id === pageId && e.event_type === 'draft.saved'));

const hiddenPublish = await dataApi('/rpc/publish_draft_snapshot', {
  token: ownerJwt, method: 'POST', body: { p_page_id: pageId, p_expected_revision: 2 }
});
assert.equal(hiddenPublish.status, 404, JSON.stringify(hiddenPublish));

const forgedParts = ownerJwt.split('.');
forgedParts[2] = (forgedParts[2][0] === 'A' ? 'B' : 'A') + forgedParts[2].slice(1);
const badSignature = await dataApi('/page_drafts?select=revision', { token: forgedParts.join('.') });
assert.equal(badSignature.status, 401, JSON.stringify(badSignature));

const fresh = clientFixture();
assert.equal(await verifyOwnerSession(fresh.client(), ownerId), null,
  'missing SSR cookies must deny');
const loggedOut = await owner.client().auth.signOut();
assert.equal(loggedOut.error, null, 'real GoTrue signout failed');
assert.equal(await verifyOwnerSession(owner.client(), ownerId), null,
  'revoked session must not authorize Owner after logout');
process.stdout.write(
  'PASS: real GoTrue JWT -> PostgREST -> actual migration RLS/RPC, SSR cookies, Owner vs Non-Owner, signout\n'
);
