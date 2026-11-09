// Next.js HTTP route regression against the same disposable GoTrue,
// PostgREST and Storage containers as the shared-stack job.
//
// Gateway maps standard Supabase /auth/v1, /rest/v1 and /storage/v1 paths to
// localhost-only services. It does not implement Auth or database semantics.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createServerClient } from '@supabase/ssr';
import { chromium } from 'playwright';

const gatewayPort=54321, appPort=3100;
const base='http://127.0.0.1:'+gatewayPort;
const app='http://localhost:'+appPort;
const ownerPassword='ci-only-ValidPassword-123456!';
const key='sb_publishable_ci_disposable_not_real';
const routes=[
  ['/auth/v1','http://127.0.0.1:9999'],
  ['/rest/v1','http://127.0.0.1:3000'],
  ['/storage/v1','http://127.0.0.1:5000']
];
const gateway=http.createServer(async(request,response)=>{
  const path=new URL(request.url,'http://127.0.0.1');
  const route=routes.find(([prefix])=>path.pathname===prefix||path.pathname.startsWith(prefix+'/'));
  if(!route){response.writeHead(404);response.end();return;}
  const [prefix,origin]=route;
  const dest=origin+path.pathname.slice(prefix.length)+path.search;
  try{
    const chunks=[];
    for await(const chunk of request)chunks.push(chunk);
    const body=Buffer.concat(chunks);
    const headers={...request.headers};
    delete headers.host;
    delete headers.connection;
    delete headers['content-length'];
    // Supabase's API gateway recognizes a publishable key and forwards an
    // anonymous PostgREST request. Our minimal CI gateway must do the same;
    // PostgREST itself cannot validate a publishable-key bearer token.
    if(prefix==='/rest/v1' && headers.authorization==='Bearer '+key)
      delete headers.authorization;
    const upstream=await fetch(dest,{
      method:request.method,
      headers,
      redirect:'manual',
      ...(body.length?{body}:{})
    });
    const outHeaders={};
    for(const [name,value] of upstream.headers) {
      if(!['transfer-encoding','content-encoding','connection'].includes(name))
        outHeaders[name]=value;
    }
    const bytes=Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status,outHeaders);response.end(bytes);
  } catch(error){
    response.writeHead(502,{'content-type':'text/plain'});
    response.end('Local test gateway failure');
    console.error('Gateway error',String(error));
  }
});
await new Promise(resolve=>gateway.listen(gatewayPort,'127.0.0.1',resolve));

async function signIn(email){
  const cookieJar=new Map();
  const client=createServerClient(base,key,{
    cookies:{
      getAll:()=>[...cookieJar].map(([name,value])=>({name,value})),
      setAll:items=>items.forEach(({name,value,options})=>{
        if(!value||options?.maxAge===0)cookieJar.delete(name);
        else cookieJar.set(name,value);
      })
    }
  });
  const {data,error}=await client.auth.signInWithPassword({
    email,password:ownerPassword
  });
  assert.equal(error,null,'local GoTrue sign in should succeed');
  assert.ok(cookieJar.size,'Supabase SSR SDK did not write cookies');
  return {
    user:data.user,
    token:data.session?.access_token,
    cookie:[...cookieJar].map(([name,value])=>
      encodeURIComponent(name)+'='+encodeURIComponent(value)).join('; ')
  };
}
async function register(email){
  const r=await fetch(base+'/auth/v1/signup',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({email,password:ownerPassword})
  });
  const json=await r.json();
  assert.equal(r.status,200,JSON.stringify(json));
  assert.match(json.user?.id??'',/^[0-9a-f-]{36}$/i);
  return json.user.id;
}
const ownerEmail='next-owner-ci@example.invalid';
const foreignEmail='next-nonowner-ci@example.invalid';
const ownerId=await register(ownerEmail);
const foreignId=await register(foreignEmail);
assert.notEqual(ownerId,foreignId);

const {execFileSync}=await import('node:child_process');
execFileSync('docker',[
  'run','--rm','--network','host','-e','PGPASSWORD=ci-only-local-password',
  'postgres:17','psql','-h','127.0.0.1','-U','postgres','-d','storage_http_ci',
  '-v','ON_ERROR_STOP=1','-c',
  "UPDATE public.owner_config SET auth_user_id='"+ownerId+"'::uuid WHERE singleton;"+
  "UPDATE public.pages SET deleted_at=now() WHERE deleted_at IS NULL"
],{stdio:'pipe'});

const env={
  ...process.env,
  NODE_ENV:'production',
  PORT:String(appPort),
  HOSTNAME:'localhost',
  NEXT_PUBLIC_SUPABASE_URL:base,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key,
  OWNER_AUTH_USER_ID:ownerId,
  PHASE2_PAGE_CREATE_ENABLED:'true',
  PHASE2_DRAFT_WRITE_ENABLED:'true',
  PHASE2_PAGE_LIST_ENABLED:'true',
  PHASE2_PUBLISH_ENABLED:'true',
  PHASE2_PUBLIC_RENDER_ENABLED:'true',
  PHASE2_MEDIA_UPLOAD_ENABLED:'true',
  PHASE2_MEDIA_SIGN_ENABLED:'true'
};
const readOnlyEnv={
  ...env,
  PHASE2_PAGE_CREATE_ENABLED:'false',
  PHASE2_DRAFT_WRITE_ENABLED:'false',
  PHASE2_PUBLISH_ENABLED:'false',
  PHASE2_PUBLIC_RENDER_ENABLED:'false',
  PHASE2_MEDIA_UPLOAD_ENABLED:'false',
  PHASE2_MEDIA_SIGN_ENABLED:'false'
};
let server;
let browser;
async function startServer(config){
  server=spawn(process.execPath,
    ['node_modules/next/dist/bin/next','start','-p',String(appPort),'-H','localhost'],
    {env:config,stdio:['ignore','pipe','pipe']});
  let output='';
  for(const stream of [server.stdout,server.stderr])
    stream.on('data',data=>{output=(output+data.toString()).slice(-8000);});
  let ready=false;
  for(let i=0;i<80;i++){
    if(server.exitCode!==null)break;
    try{
      const r=await fetch(app+'/login',{redirect:'manual'});
      if(r.status===200){ready=true;break;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(ready,'Next server never became ready: '+output);
}
async function stopServer(){
  if(!server||server.exitCode!==null)return;
  server.kill('SIGTERM');
  await new Promise(resolve=>{
    server.once('exit',resolve);
    setTimeout(resolve,1500).unref();
  });
}
try{
  await startServer(readOnlyEnv);

  const owner=await signIn(ownerEmail);
  const other=await signIn(foreignEmail);
  assert.equal(owner.user.id,ownerId);
  assert.equal(other.user.id,foreignId);

  async function call(path,{cookie,method='GET',body,origin=app,extraHeaders={}}={}){
    const response=await fetch(app+path,{
      method,redirect:'manual',
      headers:{
        ...(cookie?{cookie}:{}),
        ...(method!=='GET'?{origin,'content-type':'application/json'}:{}),
        ...extraHeaders
      },
      ...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    const raw=await response.text();let data;
    try{data=JSON.parse(raw);}catch{data=raw;}
    return {status:response.status,data,headers:response.headers};
  }

  browser=await chromium.launch({headless:true});
  async function browserSession(cookie){
    const context=await browser.newContext();
    if(cookie)await context.addCookies(cookie.split('; ').map(piece=>{
      const index=piece.indexOf('=');
      return {
        name:decodeURIComponent(piece.slice(0,index)),
        value:decodeURIComponent(piece.slice(index+1)),url:app
      };
    }));
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    return {context,page,errors};
  }
  const ownerBrowser=await browserSession(owner.cookie);
  const emptyList=await call('/api/admin/pages',{cookie:owner.cookie});
  assert.equal(emptyList.status,200,JSON.stringify(emptyList.data));
  assert.deepEqual(emptyList.data.pages,[],
    'read-only list should be empty before the Next HTTP fixture creates a page');
  await ownerBrowser.page.goto(app+'/admin');
  await ownerBrowser.page.getByRole('link',{name:/ดูรายการหน้าทั้งหมด/}).click();
  assert.match(ownerBrowser.page.url(),/\/admin\/pages$/);
  await ownerBrowser.page.getByRole('heading',{name:'หน้าทั้งหมด'}).waitFor();
  assert.equal(await ownerBrowser.page.getByText('ยังไม่มีหน้าที่แสดงในรายการ').count(),1);
  assert.equal(await ownerBrowser.page.getByRole('link',{name:/สร้างหน้าฉบับร่างใหม่/}).count(),0);
  for(const cookie of [undefined,other.cookie]){
    const visitor=await browserSession(cookie);
    await visitor.page.goto(app+'/admin/pages');
    await visitor.page.waitForURL(/\/login/);
    assert.deepEqual(visitor.errors,[]);
    await visitor.context.close();
  }
  assert.deepEqual(ownerBrowser.errors,[],'empty-state browser page errors');
  await stopServer();
  await startServer(env);

  const noCode=await call('/auth/callback');
  assert.ok([302,303,307,308].includes(noCode.status));
  assert.match(noCode.headers.get('location')??'',/\/login\?error=callback/);
  const badCode=await call('/auth/callback?code=invalid-pkce-one-time-code');
  assert.ok([302,303,307,308].includes(badCode.status));
  assert.match(badCode.headers.get('location')??'',/\/login\?error=callback/);

  // Anonymous and Non-Owner cannot enter the actual Next admin page,
  // and their API requests fail even when the CI-only write flags are on.
  for(const cookie of [undefined,other.cookie]){
    const page=await call('/admin',{cookie});
    assert.ok([302,303,307,308].includes(page.status),
      'unverified /admin should redirect: '+page.status);
    assert.match(page.headers.get('location')??'',/\/login/);
    const denied=await call('/api/admin/pages',{cookie});
    assert.equal(denied.status,403,JSON.stringify(denied.data));
  }
  const access=await call('/admin',{cookie:owner.cookie});
  assert.equal(access.status,200,JSON.stringify(access.data).slice(0,700));
  assert.ok(String(access.data).includes('แผงควบคุม'),
    'Owner page did not render dashboard');

  const document={name:'Next HTTP Owner',description:'',links:[]};
  const deniedCrossOrigin=await call('/api/admin/pages',{
    cookie:owner.cookie,method:'POST',origin:'https://untrusted.example.invalid',
    body:{slug:'next-csrf',document}
  });
  assert.equal(deniedCrossOrigin.status,403,
    'cross-origin request unexpectedly accepted');
  const create=await call('/api/admin/pages',{
    cookie:owner.cookie,method:'POST',
    body:{slug:'next-http-owner',document}
  });
  assert.equal(create.status,201,JSON.stringify(create.data));
  assert.equal(create.data.revision,1);
  const pageId=create.data.pageId;
  assert.match(pageId,/^[0-9a-f-]{36}$/i);

  const list=await call('/api/admin/pages',{cookie:owner.cookie});
  assert.equal(list.status,200,JSON.stringify(list.data));
  assert.ok(list.data.pages.some(row=>row.id===pageId),
    'Owner page list missing created page');

  const draft=await call('/api/admin/drafts/'+pageId,{cookie:owner.cookie});
  assert.equal(draft.status,200,JSON.stringify(draft.data));
  assert.equal(draft.data.revision,1);

  const otherDraft=await call('/api/admin/drafts/'+pageId,{cookie:other.cookie});
  assert.equal(otherDraft.status,403,JSON.stringify(otherDraft.data));

  const patched=await call('/api/admin/drafts/'+pageId,{
    cookie:owner.cookie,method:'PATCH',
    body:{expectedRevision:1,document:{...document,name:'Updated Next HTTP'}}
  });
  assert.equal(patched.status,200,JSON.stringify(patched.data));
  assert.equal(patched.data.revision,2);

  const stale=await call('/api/admin/drafts/'+pageId,{
    cookie:owner.cookie,method:'PATCH',
    body:{expectedRevision:1,document}
  });
  assert.equal(stale.status,409,JSON.stringify(stale.data));

  const invalidOrigin=await call('/api/admin/drafts/'+pageId,{
    cookie:owner.cookie,method:'PATCH',
    origin:'https://untrusted.example.invalid',
    body:{expectedRevision:2,document}
  });
  assert.equal(invalidOrigin.status,403);

  const verified=await call('/api/admin/drafts/'+pageId,{cookie:owner.cookie});
  assert.equal(verified.status,200);
  assert.equal(verified.data.revision,2);

  // Only explicit Owner publication can make a private snapshot public.
  // A published-but-unlisted snapshot must stay inaccessible anonymously.
  const slug='next-http-owner';
  const hiddenBefore=await call('/'+slug);
  assert.equal(hiddenBefore.status,404,'draft profile became public before release');
  const foreignPublish=await call('/api/admin/publish/'+pageId,{
    cookie:other.cookie,method:'POST',
    body:{expectedRevision:2,makePublic:true}
  });
  assert.equal(foreignPublish.status,403,JSON.stringify(foreignPublish.data));
  const anonPublish=await call('/api/admin/publish/'+pageId,{
    method:'POST',body:{expectedRevision:2,makePublic:true}
  });
  assert.equal(anonPublish.status,403,JSON.stringify(anonPublish.data));
  const csrfPublish=await call('/api/admin/publish/'+pageId,{
    cookie:owner.cookie,method:'POST',origin:'https://untrusted.example.invalid',
    body:{expectedRevision:2,makePublic:true}
  });
  assert.equal(csrfPublish.status,403,JSON.stringify(csrfPublish.data));

  const unlisted=await call('/api/admin/publish/'+pageId,{
    cookie:owner.cookie,method:'POST',
    body:{expectedRevision:2,makePublic:false}
  });
  assert.equal(unlisted.status,200,JSON.stringify(unlisted.data));
  assert.equal(unlisted.data.visibility,'unlisted');
  assert.equal(unlisted.data.versionNumber,1);
  assert.equal((await call('/'+slug)).status,404,'unlisted snapshot leaked');

  const publicRelease=await call('/api/admin/publish/'+pageId,{
    cookie:owner.cookie,method:'POST',
    body:{expectedRevision:2,makePublic:true}
  });
  assert.equal(publicRelease.status,200,JSON.stringify(publicRelease.data));
  assert.equal(publicRelease.data.versionNumber,2);
  const publicPage=await call('/'+slug);
  assert.equal(publicPage.status,200,JSON.stringify(publicPage.data).slice(0,350));
  assert.ok(String(publicPage.data).includes('Updated Next HTTP'),
    'public route did not display the immutable published profile');

  const staleRelease=await call('/api/admin/publish/'+pageId,{
    cookie:owner.cookie,method:'POST',
    body:{expectedRevision:1,makePublic:false}
  });
  assert.equal(staleRelease.status,409,JSON.stringify(staleRelease.data));
  assert.equal((await call('/'+slug)).status,200,
    'stale publication unexpectedly changed visibility');

  const edited=await call('/api/admin/drafts/'+pageId,{
    cookie:owner.cookie,method:'PATCH',
    body:{expectedRevision:2,document:{...document,name:'Not yet released'}}
  });
  assert.equal(edited.status,200,JSON.stringify(edited.data));
  const currentPublic=await call('/'+slug);
  assert.equal(currentPublic.status,200);
  assert.ok(String(currentPublic.data).includes('Updated Next HTTP'));
  assert.ok(!String(currentPublic.data).includes('Not yet released'),
    'private draft leaked into immutable public profile');

  const removePublic=await call('/api/admin/publish/'+pageId,{
    cookie:owner.cookie,method:'POST',
    body:{expectedRevision:3,makePublic:false}
  });
  assert.equal(removePublic.status,200,JSON.stringify(removePublic.data));
  assert.equal((await call('/'+slug)).status,404,
    'unlisted republish did not revoke public route access');

  // Real Next.js media API must validate file magic, size, Owner and CSRF
  // before invoking the actual private Storage HTTP service with the Owner JWT.
  const png=Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/u74AAAAASUVORK5CYII=',
    'base64'
  );
  async function sendImage(cookie, origin, bytes, mime='image/png'){
    const response=await fetch(app+'/api/admin/media/upload',{
      method:'POST',headers:{
        ...(cookie?{cookie}:{}),origin,'content-type':mime
      },body:bytes
    });
    const value=await response.json();
    return {status:response.status,value};
  }
  assert.equal((await sendImage(undefined,app,png)).status,403);
  assert.equal((await sendImage(other.cookie,app,png)).status,403);
  assert.equal((await sendImage(owner.cookie,'https://untrusted.example.invalid',png)).status,403);
  assert.equal((await sendImage(owner.cookie,app,Buffer.from('not a real PNG'))).status,415);
  const media=await sendImage(owner.cookie,app,png);
  assert.equal(media.status,201,JSON.stringify(media.value));
  assert.ok(media.value.path.startsWith('profiles/'+ownerId+'/') &&
    media.value.path.endsWith('.png'), 'server did not assign an Owner-scoped PNG path');
  assert.equal(media.value.sizeBytes,png.length);
  const signOther=await call('/api/admin/media/sign',{
    cookie:other.cookie,method:'POST',body:{path:media.value.path}
  });
  assert.equal(signOther.status,403);
  const signTraversed=await call('/api/admin/media/sign',{
    cookie:owner.cookie,method:'POST',
    body:{path:'profiles/'+ownerId+'/../secret.png'}
  });
  assert.equal(signTraversed.status,422);
  const signDifferentOwner=await call('/api/admin/media/sign',{
    cookie:owner.cookie,method:'POST',
    body:{path:'profiles/'+foreignId+'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png'}
  });
  assert.equal(signDifferentOwner.status,422);
  const signedMedia=await call('/api/admin/media/sign',{
    cookie:owner.cookie,method:'POST',body:{path:media.value.path}
  });
  assert.equal(signedMedia.status,200,JSON.stringify(signedMedia.data));
  assert.equal(signedMedia.data.expiresIn,60);
  const signedImage=await fetch(signedMedia.data.signedUrl);
  assert.equal(signedImage.status,200,'signed media URL not downloadable');
  assert.deepEqual(Buffer.from(await signedImage.arrayBuffer()),png,
    'signed media URL content differs from uploaded bytes');

  // Seed one private draft before switching the application back to
  // read-only mode; browser checks below never create or edit a page.
  const browserDraft=await call('/api/admin/pages',{
    cookie:owner.cookie,method:'POST',
    body:{slug:'browser-readonly-draft',document}
  });
  assert.equal(browserDraft.status,201,JSON.stringify(browserDraft.data));

  // Run the actual Owner list against disposable GoTrue and PostgREST with
  // every write and public-release switch off. Reads must leave DB rows intact.
  async function databaseSnapshot(){
    const result={};
    for(const [table,columns] of [
      ['pages','id,slug,status,visibility,updated_at'],
      ['page_drafts','page_id,revision,updated_at'],
      ['audit_events','id,event_type,entity_id']
    ]){
      const response=await fetch(base+'/rest/v1/'+table+'?select='+columns+'&order='+
        (table==='pages'?'id':table==='page_drafts'?'page_id':'id')+'.asc',{
        headers:{authorization:'Bearer '+owner.token}
      });
      const body=await response.text();
      assert.equal(response.status,200,table+' snapshot failed: '+body);
      result[table]=JSON.parse(body);
    }
    return result;
  }
  assert.ok(owner.token,'Owner must have a real GoTrue JWT');
  const beforeRead=await databaseSnapshot();
  await stopServer();
  await startServer(readOnlyEnv);

  for(const cookie of [undefined,other.cookie]){
    const denied=await call('/api/admin/pages',{cookie});
    assert.equal(denied.status,403,JSON.stringify(denied.data));
    assert.deepEqual(denied.data,{error:'forbidden'});
    const deniedUi=await call('/admin/pages',{cookie});
    assert.ok([302,303,307,308].includes(deniedUi.status));
    assert.match(deniedUi.headers.get('location')??'',/\/login/);
  }
  const readOnlyList=await call('/api/admin/pages',{cookie:owner.cookie});
  assert.equal(readOnlyList.status,200,JSON.stringify(readOnlyList.data));
  assert.match(readOnlyList.headers.get('cache-control')??'',/no-store/);
  assert.equal(readOnlyList.data.cappedAt,50);
  assert.ok(readOnlyList.data.pages.length<=50);
  const listed=readOnlyList.data.pages.find(row=>row.id===pageId);
  assert.ok(listed,'Owner list omitted the existing private page');
  assert.deepEqual(Object.keys(listed).sort(),
    ['id','slug','status','visibility','updated_at'].sort());
  assert.equal(listed.slug,slug);
  const readOnlyUi=await call('/admin/pages',{cookie:owner.cookie});
  assert.equal(readOnlyUi.status,200);
  assert.ok(String(readOnlyUi.data).includes(slug));
  assert.ok(!String(readOnlyUi.data).includes('เปิดตัวแก้ไขฉบับร่าง'));
  await ownerBrowser.page.goto(app+'/admin');
  await ownerBrowser.page.getByRole('link',{name:/ดูรายการหน้าทั้งหมด/}).click();
  assert.match(ownerBrowser.page.url(),/\/admin\/pages$/);
  await ownerBrowser.page.getByRole('heading',{name:'หน้าทั้งหมด'}).waitFor();
  assert.equal(await ownerBrowser.page.getByText(slug,{exact:true}).count(),1);
  assert.equal(await ownerBrowser.page.getByText('browser-readonly-draft',{exact:true}).count(),1);
  assert.equal(await ownerBrowser.page.getByText('ยังไม่มีหน้าที่แสดงในรายการ').count(),0);
  assert.equal(await ownerBrowser.page.getByRole('link',{name:/เปิดตัวแก้ไขฉบับร่าง/}).count(),0);
  assert.equal(await ownerBrowser.page.getByRole('link',{name:/สร้างหน้าฉบับร่างใหม่/}).count(),0);
  assert.deepEqual(ownerBrowser.errors,[],'populated-state browser page errors');
  const foreignRows=await fetch(base+'/rest/v1/pages?select=id,slug',{
    headers:{authorization:'Bearer '+other.token}
  });
  assert.equal(foreignRows.status,200);
  assert.deepEqual(await foreignRows.json(),[],
    'Non-Owner must not read page metadata directly through PostgREST');
  for(const [path,method,body] of [
    ['/api/admin/pages','POST',{slug:'read-only-denied',document}],
    ['/api/admin/drafts/'+pageId,'PATCH',{expectedRevision:3,document}],
    ['/api/admin/publish/'+pageId,'POST',{expectedRevision:3,makePublic:true}]
  ]){
    const denied=await call(path,{cookie:owner.cookie,method,body});
    assert.equal(denied.status,404,path+' was available with write flags disabled');
  }
  assert.equal((await call('/'+slug)).status,404,
    'public render was available with release flag disabled');
  assert.deepEqual(await databaseSnapshot(),beforeRead,
    'Owner Page List or denied requests changed pages, drafts, or audit rows');

  // Sign-out of a real GoTrue SSR session clears the request cookie jar.
  // The protected Next route must reject a browser after local logout.
  const jar=new Map(owner.cookie.split('; ').map(piece=>{
    const index=piece.indexOf('=');
    return [decodeURIComponent(piece.slice(0,index)),
      decodeURIComponent(piece.slice(index+1))];
  }));
  const signoutClient=createServerClient(base,key,{
    cookies:{
      getAll:()=>[...jar].map(([name,value])=>({name,value})),
      setAll:items=>items.forEach(({name,value,options})=>{
        if(!value||options?.maxAge===0)jar.delete(name);
        else jar.set(name,value);
      })
    }
  });
  const signedOut=await signoutClient.auth.signOut();
  assert.equal(signedOut.error,null,'GoTrue SSR logout failed');
  const clearedCookie=[...jar].map(([name,value])=>
    encodeURIComponent(name)+'='+encodeURIComponent(value)).join('; ');
  const afterLogout=await call('/admin',{cookie:clearedCookie});
  assert.ok([302,303,307,308].includes(afterLogout.status),
    'signed-out browser still reached admin');
  assert.match(afterLogout.headers.get('location')??'',/\/login/);

  console.log('PASS: Chromium empty/populated Owner Page List navigation and Non-Owner denial, read-only Next HTTP, real GoTrue SSR cookies, PostgREST RLS, CSRF, CAS and explicit immutable publish privacy');
} finally {
  if(browser)await browser.close();
  await stopServer();
  gateway.close();
}
