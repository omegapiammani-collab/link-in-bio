import assert from 'node:assert/strict';

// Post-restore GoTrue HTTP acceptance, on a NEW disposable DB and process.
const origin = 'http://127.0.0.1:9998';
const expected = process.env.EXPECTED_RESTORED_OWNER_UUID;
assert.match(expected || '', /^[0-9a-f-]{36}$/i, 'missing isolated expected Owner UUID');
async function login(email, password) {
  const response = await fetch(origin + '/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  return { status: response.status, data };
}
const owner = await login('owner-ci@example.invalid', 'ci-only-ValidPassword-123456!');
assert.equal(owner.status, 200, JSON.stringify(owner));
assert.equal(owner.data.user?.id, expected, 'restored Owner login mapped to wrong auth.users');
assert.ok(owner.data.access_token, 'restored GoTrue did not issue access token');
const stranger = await login('nonowner-ci@example.invalid', 'ci-only-ValidPassword-123456!');
assert.equal(stranger.status, 200, JSON.stringify(stranger));
assert.notEqual(stranger.data.user?.id, expected, 'restored accounts were conflated');
const invalid = await login('owner-ci@example.invalid', 'deliberately-wrong-password');
assert.equal(invalid.status, 400, JSON.stringify(invalid));
process.stdout.write(
  'PASS: isolated restored GoTrue serves real login for Owner/Non-Owner and rejects wrong password\n'
);
