import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/0005_audited_draft_transactions.sql', import.meta.url),
  'utf8'
);
const createRoute = readFileSync(new URL('../src/app/api/admin/pages/route.ts', import.meta.url), 'utf8');
const saveRoute = readFileSync(new URL('../src/app/api/admin/drafts/[pageId]/route.ts', import.meta.url), 'utf8');

test('draft SQL defines atomic create, save, audit and optimistic revision checks', () => {
  assert.match(migration, /create or replace function app_private\.create_page_draft_audited/);
  assert.match(migration, /create or replace function app_private\.save_page_draft_audited/);
  assert.match(migration, /insert into public\.pages/);
  assert.match(migration, /insert into public\.page_drafts/);
  assert.match(migration, /update public\.page_drafts/);
  assert.match(migration, /insert into public\.audit_events/g);
  assert.match(migration, /d\.revision = p_expected_revision/);
  assert.match(migration, /raise exception 'revision_conflict'/);
});

test('SQL functions are least-privilege and preserve owner boundary', () => {
  assert.equal((migration.match(/create or replace function /g) || []).length, 5);
  assert.match(migration, /security definer set search_path = ''/);
  assert.match(migration, /security invoker set search_path = ''/);
  assert.equal((migration.match(/not \(select app_private\.is_owner\(\)\)/g) || []).length, 2);
  assert.match(migration, /revoke all on function public\.create_page_draft_audited/);
  assert.match(migration, /revoke all on function public\.save_page_draft_audited/);
  assert.match(migration, /revoke insert, update, delete on public\.pages from authenticated/);
  assert.match(migration, /revoke insert, update, delete on public\.page_drafts from authenticated/);
  assert.match(migration, /create or replace function app_private\.assert_draft_document/);
});

test('create and save API routes fail closed and call audited RPC only', () => {
  assert.match(createRoute, /PHASE2_PAGE_CREATE_ENABLED/);
  assert.match(createRoute, /PHASE2_DRAFT_WRITE_ENABLED/);
  assert.match(createRoute, /getOwner\(\)/);
  assert.match(createRoute, /origin_forbidden/);
  assert.match(createRoute, /normalizeDraftDocument/);
  assert.match(createRoute, /rpc\('create_page_draft_audited'/);
  assert.match(saveRoute, /rpc\('save_page_draft_audited'/);
  assert.match(saveRoute, /revision_conflict/);
  assert.doesNotMatch(saveRoute, /\.update\(\{profile_json/);
});
