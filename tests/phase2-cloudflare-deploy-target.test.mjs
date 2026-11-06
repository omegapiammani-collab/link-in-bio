import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PHASE2_STAGING_WORKER, PHASE2_STAGING_SUPABASE_URL } from '../src/lib/config/phase2-staging-preflight.mjs';

// This regression protects the Phase 1 Worker from accidental deployment
// when somebody builds or deploys from the Phase 2 feature branch.
test('Cloudflare deployment target is the separate Phase 2 Worker', () => {
  const config = readFileSync(new URL('../cloudflare.config.ts', import.meta.url), 'utf8');
  assert.ok(config.includes('name: "' + PHASE2_STAGING_WORKER + '"'));
  assert.ok(!config.includes('name: "link-in-bio-preview"'));
});
test('Cloudflare CI build does not use hosted Production project URL', () => {
  const workflow = readFileSync(new URL('../.github/workflows/checks.yml', import.meta.url), 'utf8');
  assert.ok(workflow.includes('NEXT_PUBLIC_SUPABASE_URL: ' + PHASE2_STAGING_SUPABASE_URL));
  assert.ok(!workflow.includes('NEXT_PUBLIC_SUPABASE_URL: https://mmbhuxiejfqipttyujop.supabase.co'));
});
