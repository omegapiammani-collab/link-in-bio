import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDraftDocument, validExternalUrl, isUuid } from '../src/lib/domain/draft-contract.mjs';

const one = 'd50ebcde-70cf-4e98-9efe-72e467975364';
const doc = { name: 'ทดสอบ', description: 'รายละเอียด', links: [
  { id: one, title: 'เว็บไซต์', url: 'https://example.com/path', active: true }
] };

test('valid draft normalizes and retains safe links', () => {
  assert.deepEqual(normalizeDraftDocument(doc), doc);
  assert.equal(isUuid(one), true);
});

test('reject executable, credential-bearing and whitespace-containing URLs', () => {
  const rejected = [
    'javascript:alert(1)', 'data:text/html,test', 'https://u:p@example.com',
    'https://example.com/ a', 'https://example.com\n', 'https://example.com\t'
  ];
  for (const url of rejected) assert.equal(validExternalUrl(url), false, url);
});

test('reject canonicalized numeric IP, IPv6, local and malformed DNS hosts', () => {
  const rejected = [
    'http://localhost', 'http://localhost.', 'http://admin.local',
    'http://admin.internal', 'http://admin.test', 'http://router.home.arpa',
    'http://127.0.0.1', 'http://2130706433', 'http://0x7f000001',
    'http://0177.0.0.1', 'http://[::1]', 'http://[2001:db8::1]',
    'https://example.com.', 'https://bad..example.com',
    'https://-bad.example.com', 'https://bad-.example.com',
    'https://example.123'
  ];
  for (const url of rejected) assert.equal(validExternalUrl(url), false, url);
});

test('accept ordinary external HTTPS and HTTP domains', () => {
  for (const url of [
    'https://example.org', 'http://sub.example.com/path?q=1',
    'https://example.co.th', 'https://xn--12c1fe0br.xn--o3cw4h'
  ]) assert.equal(validExternalUrl(url), true, url);
});

test('reject invalid profiles, oversized links, duplicates and malformed payloads', () => {
  for (const input of [
    null, {}, { ...doc, name: ' ' }, { ...doc, description: 'a'.repeat(501) },
    { ...doc, links: Array(21).fill(doc.links[0]) },
    { ...doc, links: [doc.links[0], doc.links[0]] },
    { ...doc, links: [{ ...doc.links[0], id: 'not-uuid' }] },
    { ...doc, links: [{ ...doc.links[0], active: 'yes' }] },
    { ...doc, links: [{ ...doc.links[0], url: 'http://2130706433' }] }
  ]) assert.throws(() => normalizeDraftDocument(input));
});
