import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDraftDocument,validExternalUrl,isUuid} from '../src/lib/domain/draft-contract.mjs';

const one='d50ebcde-70cf-4e98-9efe-72e467975364';
const doc={name:'ทดสอบ',description:'รายละเอียด',links:[{id:one,title:'เว็บไซต์',url:'https://example.com/path',active:true}]};
test('valid draft normalizes and retains safe links',()=>{
  assert.deepEqual(normalizeDraftDocument(doc),doc);
  assert.equal(isUuid(one),true);
});
test('reject executable, local, credential-bearing, and whitespace-containing URLs',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,test','https://u:p@example.com','http://localhost','https://127.0.0.1','https://example.com/ a','https://example.com\n']) assert.equal(validExternalUrl(url),false,url);
  assert.equal(validExternalUrl('https://example.org'),true);
});
test('reject invalid profiles, oversized links, duplicates, and malformed payloads',()=>{
  for(const input of [null,{}, {...doc,name:' '},{...doc,description:'a'.repeat(501)},{...doc,links:Array(21).fill(doc.links[0])},{...doc,links:[doc.links[0],doc.links[0]]},{...doc,links:[{...doc.links[0],id:'not-uuid'}]},{...doc,links:[{...doc.links[0],active:'yes'}]}]) {
    assert.throws(()=>normalizeDraftDocument(input));
  }
});
