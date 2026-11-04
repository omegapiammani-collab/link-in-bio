// Deployment preflight: validate *only* the intended isolated Phase 2
// staging runtime. No network, credentials, OAuth tokens or cloud mutations.
export const PHASE2_STAGING_PROJECT_REF='hfsvnbbckfugrxugrnuc';
export const PHASE2_STAGING_SUPABASE_URL='https://'+PHASE2_STAGING_PROJECT_REF+'.supabase.co';
export const PHASE2_STAGING_WORKER='link-in-bio-phase2-preview';
export const PHASE2_STAGING_ORIGIN='https://'+PHASE2_STAGING_WORKER+'.omega-piammani.workers.dev';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DANGEROUS_FLAGS=[
 'PHASE2_PAGE_CREATE_ENABLED',
 'PHASE2_DRAFT_WRITE_ENABLED',
 'PHASE2_PAGE_LIST_ENABLED',
 'PHASE2_PUBLISH_ENABLED',
 'PHASE2_PUBLIC_RENDER_ENABLED',
 'PHASE2_MEDIA_UPLOAD_ENABLED',
 'PHASE2_MEDIA_SIGN_ENABLED'
];

export function validatePhase2StagingEnv(env){
 const errors=[];
 const get=key=>typeof env[key]==='string'?env[key]:'';
 if(get('NEXT_PUBLIC_SUPABASE_URL')!==PHASE2_STAGING_SUPABASE_URL)
  errors.push('Supabase URL must be the isolated Phase 2 test project');
 const key=get('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
 if(!key.startsWith('sb_publishable_')||key==='sb_publishable_test_only'||
    /\s/.test(key)||key.length<32)
  errors.push('Provide the test project publishable key (not a test placeholder)');
 const owner=get('OWNER_AUTH_USER_ID');
 if(!UUID.test(owner)||owner==='00000000-0000-0000-0000-000000000000')
  errors.push('Provide the Phase 2 test Owner UUID from its own Auth users');
 for(const name of DANGEROUS_FLAGS){
  if(get(name) && get(name)!=='false') errors.push(name+' must remain false for first rollout');
 }
 if(get('SUPABASE_SERVICE_ROLE_KEY')||get('SUPABASE_SECRET_KEY'))
  errors.push('No service-role or secret Supabase key in this deployment preflight');
 if(get('PHASE2_EXPECTED_ORIGIN')!==PHASE2_STAGING_ORIGIN)
  errors.push('Expected origin must be the isolated Phase 2 Worker URL');
 return {ok:errors.length===0,errors};
}
