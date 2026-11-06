import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const route = read('src/app/api/admin/pages/route.ts');
const ui = read('src/app/admin/pages/page.tsx');
const preflight = read('src/lib/config/phase2-staging-preflight.mjs');
test('Owner index is flag-gated and returns only page metadata', () => {
 const get = route.split('export async function GET()')[1];
 assert.ok(get);
 assert.match(get, /PHASE2_PAGE_LIST_ENABLED/);
 assert.match(get, /getOwner/);
 assert.match(get, /id,slug,status,visibility,updated_at/);
 assert.match(get, /\.limit\(50\)/);
 assert.doesNotMatch(get, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});
test('Page index restricts editor links behind draft write flag', () => {
 assert.match(ui, /PHASE2_PAGE_LIST_ENABLED/);
 assert.match(ui, /PHASE2_DRAFT_WRITE_ENABLED/);
 assert.match(ui, /canEdit && page.status === 'draft'/);
});
test('Staging rejects write and public feature flags', () => {
 for (const flag of ['PHASE2_PAGE_CREATE_ENABLED','PHASE2_DRAFT_WRITE_ENABLED','PHASE2_PUBLISH_ENABLED','PHASE2_PUBLIC_RENDER_ENABLED']) assert.ok(preflight.includes(flag));
});
