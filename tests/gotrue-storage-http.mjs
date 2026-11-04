// Real GoTrue-issued JWT -> real isolated Storage HTTP file backend.
// Both services are disposable. A privileged test-only synchronization maps
// real GoTrue identities to storage's existing app Owner RLS fixture; this is
// not a full single-database Supabase stack or Google OAuth acceptance.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const auth = 'http://127.0.0.1:9999';
const storage = 'http://127.0.0.1:5000';
const emailDomain = 'example.invalid';
const password = 'ci-only-ValidPassword-123456!';
const bucket = 'link-in-bio-media';
const object = 'owner/gotrue-verified.png';
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/u74AAAAASUVORK5CYII=',
  'base64'
);
const digest = data => createHash('sha256').update(data).digest('hex');

async function registerAndLogin(prefix) {
  const email = prefix + '-storage-ci@' + emailDomain;
  const signup = await fetch(auth + '/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const signedUp = await signup.json();
  assert.equal(signup.status, 200,
    'real GoTrue signup rejected: ' + JSON.stringify(signedUp));
  assert.match(signedUp.user?.id ?? '', /^[0-9a-f]{8}-[0-9a-f-]{27}$/i);

  const login = await fetch(auth + '/token?grant_type=password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const session = await login.json();
  assert.equal(login.status, 200, 'real GoTrue login rejected: ' + JSON.stringify(session));
  assert.equal(session.user?.id, signedUp.user.id);
  assert.equal(typeof session.access_token, 'string');

  const me = await fetch(auth + '/user', {
    headers: { authorization: 'Bearer ' + session.access_token }
  });
  const verified = await me.json();
  assert.equal(me.status, 200, JSON.stringify(verified));
  assert.equal(verified.id, session.user.id);
  const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url'));
  assert.equal(claims.sub, verified.id);
  assert.equal(claims.role, 'authenticated');
  return { id: verified.id, token: session.access_token };
}

function db(sql) {
  // IDs are validated UUIDs before interpolation and sent only to ephemeral CI DB.
  return execFileSync('docker', [
    'run', '--rm', '--network', 'host',
    '-e', 'PGPASSWORD=ci-only-local-password',
    'postgres:17', 'psql',
    '-h', '127.0.0.1', '-U', 'postgres', '-d', 'storage_http_ci',
    '-v', 'ON_ERROR_STOP=1', '-c', sql
  ], { encoding: 'utf8' });
}
const owner = await registerAndLogin('owner');
const nonOwner = await registerAndLogin('nonowner');
assert.notEqual(owner.id, nonOwner.id);
// The real GoTrue provider runs on a separate disposable DB in this acceptance
// job. Synchronize identities to the application DB exactly as an Auth service
// sharing this database would, without allowing browser clients to bootstrap.
db("INSERT INTO auth.users(id) VALUES ('" + owner.id +
  "'::uuid),('" + nonOwner.id + "'::uuid); " +
  "UPDATE public.owner_config SET auth_user_id='" + owner.id + "'::uuid WHERE singleton");

async function req(path, { token, method='GET', body, contentType }={}) {
  const response = await fetch(storage + path, {
    method,
    headers: {
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...(contentType ? { 'content-type': contentType } : {})
    },
    ...(body === undefined ? {} : { body })
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  let json = null;
  try { json = JSON.parse(bytes.toString()); } catch {}
  return { status: response.status, bytes, json };
}
function denied(value, reason) {
  assert.ok([400, 401, 403, 404].includes(value.status),
    reason + ': ' + value.status + ': ' + value.bytes.toString().slice(0, 600));
}
const upload = '/object/' + bucket + '/' + object;
const view = '/object/authenticated/' + bucket + '/' + object;
const sign = '/object/sign/' + bucket + '/' + object;

denied(await req(upload, { method:'POST',body:image,contentType:'image/png' }),
  'Anonymous upload unexpectedly succeeded');
denied(await req(upload, { token:nonOwner.token,method:'POST',body:image,
  contentType:'image/png' }), 'GoTrue Non-Owner upload unexpectedly succeeded');
const created = await req(upload, { token:owner.token,method:'POST',body:image,
  contentType:'image/png' });
assert.ok([200,201].includes(created.status),
  'GoTrue Owner upload failed: ' + created.status + ' ' + created.bytes.toString());

const file = await req(view, { token: owner.token });
assert.equal(file.status, 200, file.bytes.toString().slice(0, 600));
assert.equal(digest(file.bytes), digest(image), 'GoTrue Owner read corrupted PNG');
denied(await req(view, { token:nonOwner.token }), 'GoTrue Non-Owner read');
denied(await req('/object/public/'+bucket+'/'+object), 'Public private-bucket read');

const signed = await req(sign, {
  token:owner.token,method:'POST',
  contentType:'application/json',body:JSON.stringify({ expiresIn: 60 })
});
assert.equal(signed.status, 200, signed.bytes.toString());
assert.equal(typeof signed.json?.signedURL, 'string');
const url = new URL(signed.json.signedURL, storage);
const signedDownload = await req(url.pathname+url.search);
assert.equal(signedDownload.status, 200, signedDownload.bytes.toString().slice(0, 600));
assert.equal(digest(signedDownload.bytes), digest(image));
denied(await req(sign, {
  token:nonOwner.token,method:'POST',
  contentType:'application/json',body:JSON.stringify({ expiresIn:60 })
}), 'GoTrue Non-Owner signed URL creation');

const tamperedParts = owner.token.split('.');
tamperedParts[2] = (tamperedParts[2][0]==='A'?'B':'A') + tamperedParts[2].slice(1);
denied(await req(view, { token:tamperedParts.join('.') }), 'Forged GoTrue JWT');
denied(await req(upload, {
  token:nonOwner.token,method:'DELETE'
}), 'GoTrue Non-Owner delete');

const remains = await req(view, { token:owner.token });
assert.equal(remains.status, 200, 'Non-Owner delete removed Owner file');
assert.equal(digest(remains.bytes), digest(image));

console.log(
  'PASS: real GoTrue HTTP signup/login/getUser -> signed JWT -> actual Storage HTTP file upload/read/sign/deny'
);
