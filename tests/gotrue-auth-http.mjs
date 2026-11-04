// Actual Supabase Auth (GoTrue) HTTP integration against disposable Docker.
// No provider credentials, outbound sign-in, hosted Supabase or real users.
import assert from 'node:assert/strict';
import { createServerClient } from '@supabase/ssr';
import { verifyOwnerSession } from '../src/lib/auth/owner-policy.mjs';

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

const fresh = clientFixture();
assert.equal(await verifyOwnerSession(fresh.client(), ownerId), null,
  'missing SSR cookies must deny');
const loggedOut = await owner.client().auth.signOut();
assert.equal(loggedOut.error, null, 'real GoTrue signout failed');
assert.equal(await verifyOwnerSession(owner.client(), ownerId), null,
  'revoked session must not authorize Owner after logout');
process.stdout.write(
  'PASS: actual local GoTrue signup/login/getUser, SSR cookies, Owner vs Non-Owner, signout\n'
);
