// Manual read-only check for the NEXT deployment *before* any future approval.
// Command: node scripts/verify_phase2_staging_env.mjs
// Never echo credentials or user IDs to stdout.
import { validatePhase2StagingEnv } from '../src/lib/config/phase2-staging-preflight.mjs';
const result=validatePhase2StagingEnv(process.env);
if(!result.ok){
 console.error('Phase 2 staging configuration NOT ready:');
 for(const error of result.errors)console.error(' - '+error);
 process.exitCode=1;
}else{
 console.log('PASS: isolated Phase 2 staging settings and all feature flags disabled');
}
