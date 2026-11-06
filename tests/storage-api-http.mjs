// HTTP acceptance against the real, disposable Supabase Storage API service.
// No production URLs, accounts, access tokens, credentials, or external uploads.
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';

const base = 'http://127.0.0.1:5000';
const secret = 'ci-only-real-storage-signing-secret-at-least-32-chars';
const bucket = 'link-in-bio-media';
const object = 'owner/one-pixel.png';
// Valid tiny PNG, content bytes checked after roundtrip.
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/u74AAAAASUVORK5CYII=',
  'base64'
);
const checksum = value => createHash('sha256').update(value).digest('hex');
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stranger = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function jwt(sub) {
  const part = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  const signed = part({ alg: 'HS256', typ: 'JWT' }) + '.' +
    part({ sub, role: 'authenticated', aud: 'authenticated',
      iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+900 });
  return signed + '.' + createHmac('sha256', secret).update(signed).digest('base64url');
}
const ownerJwt = jwt(owner), otherJwt = jwt(stranger);

async function request(path, { token, method = 'GET', body, contentType } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(contentType ? { 'Content-Type': contentType } : {})
    },
    ...(body === undefined ? {} : { body })
  });
  const data = Buffer.from(await r.arrayBuffer());
  let json = null;
  try { json = JSON.parse(data.toString()); } catch {}
  return { status: r.status, data, json };
}
function isDenied(response, context) {
  assert.ok([400,401,403,404].includes(response.status),
    context + ': unexpectedly allowed: ' + response.status + ' ' +
    response.data.toString().slice(0,600));
}
const uploadPath = '/object/' + bucket + '/' + object;
isDenied(await request(uploadPath, {
  method: 'POST', body: image, contentType: 'image/png'
}), 'anonymous upload');
isDenied(await request(uploadPath, {
  method: 'POST', token: otherJwt, body: image, contentType: 'image/png'
}), 'Non-Owner upload');

const upload = await request(uploadPath, {
  method: 'POST', token: ownerJwt, body: image, contentType: 'image/png'
});
assert.ok([200,201].includes(upload.status),
  'Owner upload failed: ' + upload.status + ' ' + upload.data.toString());

const ownerRead = await request('/object/authenticated/' + bucket + '/' + object,
  { token: ownerJwt });
assert.equal(ownerRead.status, 200, ownerRead.data.toString().slice(0,700));
assert.equal(checksum(ownerRead.data), checksum(image), 'uploaded PNG bytes were modified');
isDenied(await request('/object/authenticated/' + bucket + '/' + object,
  { token: otherJwt }), 'Non-Owner read');
isDenied(await request('/object/public/' + bucket + '/' + object),
  'public read of private bucket');

const sign = await request('/object/sign/' + bucket + '/' + object, {
  token: ownerJwt, method: 'POST', body: JSON.stringify({ expiresIn: 60 }),
  contentType: 'application/json'
});
assert.equal(sign.status, 200, sign.data.toString().slice(0,700));
assert.equal(typeof sign.json?.signedURL, 'string');
const signedURL = sign.json.signedURL;
const signedPath = new URL(signedURL, base).pathname + new URL(signedURL, base).search;
const signedRead = await request(signedPath);
assert.equal(signedRead.status, 200, signedRead.data.toString().slice(0,700));
assert.equal(checksum(signedRead.data), checksum(image),
  'signed URL content bytes differ');
isDenied(await request('/object/sign/' + bucket + '/' + object, {
  token: otherJwt, method: 'POST', body: JSON.stringify({ expiresIn: 60 }),
  contentType: 'application/json'
}), 'Non-Owner signing');

isDenied(await request('/object/' + bucket + '/' + object, {
  token: otherJwt, method: 'DELETE'
}), 'Non-Owner delete');

process.stdout.write('PASS: real local Storage HTTP PNG upload, byte-for-byte read, signed URL, private access and RLS\n');
