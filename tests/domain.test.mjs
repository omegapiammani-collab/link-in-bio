import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSlug,isBlockVisible,failSafeCachedBlockVisible} from '../src/lib/domain/rules.mjs';
test('slug rejects reserved and malformed strings',()=>{
 for(const value of ['admin','en','bad slug','-start','end-','', 'ä']) assert.equal(validateSlug(value),false);
 for(const value of ['project-a','hello','a1']) assert.equal(validateSlug(value),true);
});
test('schedule enforces inclusive start and exclusive end',()=>{
 const b={is_active:true,schedule_start:'2026-11-03T01:00:00Z',schedule_end:'2026-11-03T02:00:00Z'};
 assert.equal(isBlockVisible(b,Date.parse('2026-11-03T00:59:59Z')),false);
 assert.equal(isBlockVisible(b,Date.parse('2026-11-03T01:00:00Z')),true);
 assert.equal(isBlockVisible(b,Date.parse('2026-11-03T02:00:00Z')),false);
 assert.equal(isBlockVisible({...b,is_active:false},Date.now()),false);
});
test('cached scheduled blocks fail closed if clock is untrusted',()=>{
 assert.equal(failSafeCachedBlockVisible({is_active:true,schedule_end:'2026-11-03T02:00:00Z'},false,0),false);
 assert.equal(failSafeCachedBlockVisible({is_active:true},false,0),true);
});
