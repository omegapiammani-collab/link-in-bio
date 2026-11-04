import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredOwnerId, isVerifiedOwner } from '../src/lib/auth/owner-policy.mjs';

const owner = 'a663bad6-815c-46be-9860-c576e01b9642';
const stranger = '47c1f07f-fef0-459b-b87c-74a426cc1d3c';

test('require a genuine RFC 4122-style UUID, not a 36-character placeholder', () => {
  assert.equal(configuredOwnerId(owner), owner);
  assert.equal(configuredOwnerId(owner.toUpperCase()), owner);
  for (const invalid of [undefined, null, '', '12345678-1234-1234-1234-123456789012',
    '00000000-0000-0000-0000-000000000000',
    'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz',
    '---------------------123456789012345',
    'not-an-owner', ' ', owner + '\n']) {
    assert.equal(configuredOwnerId(invalid), null, String(invalid));
  }
});

test('valid Owner identity is accepted only after successful verified getUser response', () => {
  assert.equal(isVerifiedOwner(owner, { id: owner }, null), true);
  assert.equal(isVerifiedOwner(owner.toUpperCase(), { id: owner }, null), true);
  assert.equal(isVerifiedOwner(owner, { id: owner.toUpperCase() }, null), true);
  assert.equal(isVerifiedOwner(owner, { id: stranger }, null), false);
  assert.equal(isVerifiedOwner(owner, { id: owner }, new Error('auth error')), false);
  assert.equal(isVerifiedOwner(owner, null, null), false);
  assert.equal(isVerifiedOwner(owner, undefined, null), false);
  assert.equal(isVerifiedOwner(owner, { id: 123 }, null), false);
  assert.equal(isVerifiedOwner(null, { id: owner }, null), false);
});
