import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerClient } from '@supabase/ssr';
import { verifyOwnerSession } from '../src/lib/auth/owner-policy.mjs';

// Real Supabase SSR SDK + cookie adapter, isolated fake Auth HTTP endpoint.
// No Google OAuth interaction, actual GoTrue service or real access tokens.
const owner = 'a663bad6-815c-46be-9860-c576e01b9642';
const stranger = '47c1f07f-fef0-459b-b87c-74a426cc1d3c';
const fakeUrl = 'https://isolated-auth.example.invalid';
const fakeKey = 'sb_publishable_ci_only_not_a_real_key';

function fixture() {
  const cookies = new Map();
  const calls = [];
  let activeUser = owner;
  let failAuth = false;

  const fetcher = async (input, init = {}) => {
    const target = new URL(typeof input === 'string' ? input : input.url);
    const method = init.method || 'GET';
    calls.push({ path: target.pathname, method });
    const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
      status, headers: { 'content-type': 'application/json' }
    });

    if (target.pathname === '/auth/v1/token' && target.searchParams.get('grant_type') === 'password') {
      return json({
        access_token: 'fixture-only-access-token',
        refresh_token: 'fixture-only-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: activeUser, email: 'isolated@example.invalid', aud: 'authenticated' }
      });
    }
    if (target.pathname === '/auth/v1/user') {
      return failAuth
        ? json({ code: 401, message: 'expired', msg: 'invalid JWT' }, 401)
        : json({ id: activeUser, email: 'isolated@example.invalid', aud: 'authenticated' });
    }
    if (target.pathname === '/auth/v1/logout') return new Response(null, { status: 204 });
    throw Error('Unexpected external request: ' + target.pathname + target.search);
  };

  const client = () => createServerClient(fakeUrl, fakeKey, {
    global: { fetch: fetcher },
    cookies: {
      getAll() {
        return Array.from(cookies, ([name, value]) => ({ name, value }));
      },
      setAll(items) {
        for (const { name, value, options } of items) {
          if (options?.maxAge === 0 || !value) cookies.delete(name);
          else cookies.set(name, value);
        }
      }
    }
  });

  return { client, cookies, calls,
    setUser(value) { activeUser = value; },
    setAuthError(value) { failAuth = value; }
  };
}

test('SSR cookies persist across server clients; getUser authorizes exact Owner', async () => {
  const env = fixture();
  const { error } = await env.client().auth.signInWithPassword({
    email: 'isolated@example.invalid', password: 'fixture-only'
  });
  assert.equal(error, null);
  // Auth's state-change subscriber applies SSR cookies asynchronously.
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(env.cookies.size > 0, 'server SDK must write cookie-backed session');
  const restored = await verifyOwnerSession(env.client(), owner);
  assert.equal(restored?.id, owner);
  assert.ok(env.calls.some(x => x.path === '/auth/v1/user'),
    'authorization must verify against Auth HTTP, not trust cookie alone');
});

test('SSR verified Owner rejects a switched identity despite an existing cookie', async () => {
  const env = fixture();
  const login = await env.client().auth.signInWithPassword({
    email: 'isolated@example.invalid', password: 'fixture-only'
  });
  assert.equal(login.error, null);
  env.setUser(stranger);
  assert.equal(await verifyOwnerSession(env.client(), owner), null);
});

test('SSR verified Owner fails closed when Auth endpoint rejects saved cookie', async () => {
  const env = fixture();
  const login = await env.client().auth.signInWithPassword({
    email: 'isolated@example.invalid', password: 'fixture-only'
  });
  assert.equal(login.error, null);
  env.setAuthError(true);
  assert.equal(await verifyOwnerSession(env.client(), owner), null);
});

test('SSR verified Owner fails closed without cookies', async () => {
  const env = fixture();
  assert.equal(await verifyOwnerSession(env.client(), owner), null);
  assert.equal(env.calls.filter(x => x.path === '/auth/v1/user').length, 0);
});
