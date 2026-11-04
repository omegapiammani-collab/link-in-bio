import test from 'node:test';
import assert from 'node:assert/strict';
import {
 validatePhase2StagingEnv, PHASE2_STAGING_PROJECT_REF,
 PHASE2_STAGING_SUPABASE_URL, PHASE2_STAGING_ORIGIN
} from '../src/lib/config/phase2-staging-preflight.mjs';
const env={
 NEXT_PUBLIC_SUPABASE_URL:PHASE2_STAGING_SUPABASE_URL,
 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_phase2_test_project_0123456789abcdef',
 OWNER_AUTH_USER_ID:'a663bad6-815c-46be-9860-c576e01b9642',
 PHASE2_EXPECTED_ORIGIN:PHASE2_STAGING_ORIGIN
};
test('staging preflight accepts only the isolated Phase 2 project with flags off',()=>{
 assert.equal(PHASE2_STAGING_PROJECT_REF,'hfsvnbbckfugrxugrnuc');
 assert.deepEqual(validatePhase2StagingEnv(env),{ok:true,errors:[]});
});
test('preflight rejects old Production project and fake publishable keys',()=>{
 for(const patch of [
  {NEXT_PUBLIC_SUPABASE_URL:'https://mmbhuxiejfqipttyujop.supabase.co'},
  {NEXT_PUBLIC_SUPABASE_URL:'http://localhost:54321'},
  {NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only'},
  {NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'service_role'},
  {PHASE2_EXPECTED_ORIGIN:'https://link-in-bio-preview.omega-piammani.workers.dev'},
  {OWNER_AUTH_USER_ID:'00000000-0000-0000-0000-000000000000'},
  {SUPABASE_SERVICE_ROLE_KEY:'should_not_exist'}
 ])assert.equal(validatePhase2StagingEnv({...env,...patch}).ok,false,JSON.stringify(patch));
});
test('all stage-changing flags default off and fail when accidentally enabled',()=>{
 for(const flag of [
 'PHASE2_PAGE_CREATE_ENABLED','PHASE2_DRAFT_WRITE_ENABLED',
 'PHASE2_PAGE_LIST_ENABLED','PHASE2_PUBLISH_ENABLED',
 'PHASE2_PUBLIC_RENDER_ENABLED','PHASE2_MEDIA_UPLOAD_ENABLED',
 'PHASE2_MEDIA_SIGN_ENABLED']){
  assert.equal(validatePhase2StagingEnv({...env,[flag]:'true'}).ok,false,flag);
  assert.equal(validatePhase2StagingEnv({...env,[flag]:'false'}).ok,true,flag);
 }
});
