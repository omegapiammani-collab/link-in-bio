import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const route = read('src/app/api/admin/pages/route.ts');
const list = read('src/app/admin/pages/page.tsx');
const dashboard = read('src/app/admin/page.tsx');

test('private page index defaults to disabled and checks Owner', () => {
  assert.match(route, /export async function GET\(\)/);
  assert.match(route, /PHASE2_PAGE_LIST_ENABLED/);
  assert.match(route, /if \(!await getOwner\(\)\)/);
  assert.match(route, /page_list_failed/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /no-store/);
});

test('list is bounded and explicitly excludes soft-deleted pages', () => {
  assert.match(route, /\.is\('deleted_at', null\)/);
  assert.match(route, /\.limit\(50\)/);
  assert.match(route, /\.order\('updated_at', \{ ascending: false \}\)/);
  assert.doesNotMatch(route, /\.select\('\*'\)/);
});

test('dashboard and private page list do not bypass feature flags', () => {
  assert.match(dashboard, /PHASE2_PAGE_LIST_ENABLED/);
  assert.match(list, /PHASE2_PAGE_LIST_ENABLED/);
  assert.match(list, /getOwner\(\)/);
  assert.match(list, /page\.status === 'draft'/);
  assert.match(list, /canEdit/);
  assert.match(list, /PHASE2_DRAFT_WRITE_ENABLED/);
});
