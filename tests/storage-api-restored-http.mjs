// After restoring BOTH PostgreSQL and file backend into a fresh isolated
// instance, verify binary content, signed read and private bucket enforcement.
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';

const base = 'http://127.0.0.1:5002';
const key = 'ci-only-real-storage-signing-secret-at-least-32-chars';
const bucket = 'link-in-bio-media';
const path = 'owner/one-pixel.png';
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/u74AAAAASUVORK5CYII=',
  'base64'
);
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const token = id => {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const raw = b64({alg:'HS256',typ:'JWT'})+'.'+b64({
    sub:id,role:'authenticated',aud:'authenticated',
    iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+900
  });
  return raw+'.'+createHmac('sha256',key).update(raw).digest('base64url');
};
const owner = token('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const stranger = token('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

async function request(path, token, method='GET', body) {
  const response=await fetch(base+path,{
    method,headers:{
      ...(token?{Authorization:'Bearer '+token}:{}),
      ...(body?{'Content-Type':'application/json'}:{})
    },...(body?{body:JSON.stringify(body)}:{})
  });
  const bytes=Buffer.from(await response.arrayBuffer());
  let json;try{json=JSON.parse(bytes.toString());}catch{}
  return {status:response.status,bytes,json};
}
const route='/object/authenticated/'+bucket+'/'+path;
const restored=await request(route,owner);
assert.equal(restored.status,200,restored.bytes.toString().slice(0,500));
assert.equal(hash(restored.bytes),hash(image),'restored bytes differ from uploaded fixture');

const hidden=await request(route,stranger);
assert.ok([400,401,403,404].includes(hidden.status),'Non-Owner read succeeded');
const publicRead=await request('/object/public/'+bucket+'/'+path);
assert.ok([400,401,403,404].includes(publicRead.status),'private bucket became public');

const signer=await request('/object/sign/'+bucket+'/'+path,owner,'POST',{expiresIn:60});
assert.equal(signer.status,200,signer.bytes.toString().slice(0,500));
const url=new URL(signer.json.signedURL,base);
const signed=await request(url.pathname+url.search);
assert.equal(signed.status,200,signed.bytes.toString().slice(0,500));
assert.equal(hash(signed.bytes),hash(image),'restored signed URL returned wrong image');
const strangerSigner=await request('/object/sign/'+bucket+'/'+path,stranger,'POST',{expiresIn:60});
assert.ok([400,401,403,404].includes(strangerSigner.status),'Non-Owner signed private object');
process.stdout.write('PASS: restored real file bytes, signed URL, Owner/Non-Owner isolation on second Storage HTTP instance\n');
