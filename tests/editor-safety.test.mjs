import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const editor = read('src/app/admin/editor/draft-editor.tsx');
const page = read('src/app/admin/editor/page.tsx');
const draftRoute = read('src/app/api/admin/drafts/[pageId]/route.ts');

test('existing draft warns on full navigation only when locally dirty', () => {
  assert.match(editor, /if \(!draftPageId \|\| !dirty\) return/);
  assert.match(editor, /addEventListener\('beforeunload', warn\)/);
  assert.match(editor, /removeEventListener\('beforeunload', warn\)/);
  assert.match(editor, /event\.preventDefault\(\)/);
  assert.match(editor, /event\.returnValue = ''/);
});

test('save, publish and reload mutually exclude overlapping requests; conflict blocks saving', () => {
  assert.match(editor, /requestInFlight = useRef\(false\)/);
  assert.match(editor, /!dirty \|\| requestInFlight\.current\) return/);
  assert.match(editor, /saving \|\| loading \|\| requestInFlight\.current\) return/);
  assert.equal((editor.match(/requestInFlight\.current = true;/g) || []).length, 3);
  assert.equal((editor.match(/requestInFlight\.current = false;/g) || []).length, 3);
  assert.match(editor, /setConflicted\(true\)/);
  assert.match(editor, /setConflicted\(false\)/);
  assert.match(page, /key=\{draftPageId \?\? 'preview'\}/);
});

test('draft PATCH checks UTF-8 body bytes and rejects malformed advertised length', () => {
  assert.match(draftRoute, /!Number\.isFinite\(declaredSize\)/);
  assert.match(draftRoute, /declaredSize < 0/);
  assert.match(draftRoute, /new TextEncoder\(\)\.encode\(raw\)\.length > 32768/);
  assert.doesNotMatch(draftRoute, /raw\.length > 32768/);
});
