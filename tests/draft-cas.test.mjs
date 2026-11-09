import test from 'node:test';
import assert from 'node:assert/strict';
import {updateExistingDraftCas} from '../src/lib/domain/draft-cas.mjs';

function fakeDb(initialRevision) {
  let revision=initialRevision;
  const calls=[];
  return {
    calls,
    from(name) {
      assert.equal(name,'page_drafts');
      const filters={};
      let patch;
      return {
        update(value) { patch=value; return this; },
        eq(key,value) { filters[key]=value;return this; },
        async select() {
          calls.push({filters:{...filters},patch});
          if(filters.revision!==revision) return {data:[],error:null};
          revision=patch.revision;
          return {data:[{revision}],error:null};
        }
      };
    }
  };
}
test('optimistic save advances revision and rejects stale writes',async()=>{
  const db=fakeDb(3);
  const document={name:'Profile',description:'',links:[]};
  const first=await updateExistingDraftCas(db,'page-1',3,document);
  assert.deepEqual(first,{ok:true,revision:4});
  assert.deepEqual(await updateExistingDraftCas(db,'page-1',3,document),{ok:false,kind:'conflict_or_missing'});
  assert.equal(db.calls[0].filters.page_id,'page-1');
  assert.deepEqual(db.calls[0].patch.profile_json,document);
  assert.equal(db.calls[0].patch.revision,4);
});
test('database errors are not misclassified as version conflicts',async()=>{
  const db={from:()=>({update:()=>({eq:()=>({eq:()=>({select:async()=>({data:null,error:new Error('offline')})})})})})};
  assert.deepEqual(await updateExistingDraftCas(db,'page-1',1,{}),{ok:false,kind:'database_error'});
});
