// Optimistic concurrency: a single SQL UPDATE, fenced by the stored revision.
// Caller must validate input, authorize Owner, and use an authenticated RLS client.
export async function updateExistingDraftCas(db, pageId, expectedRevision, document) {
  const result=await db.from('page_drafts')
    .update({profile_json:document,revision:expectedRevision+1,updated_at:new Date().toISOString()})
    .eq('page_id',pageId)
    .eq('revision',expectedRevision)
    .select('revision');
  if(result.error) return {ok:false,kind:'database_error'};
  if(!Array.isArray(result.data)||result.data.length===0) return {ok:false,kind:'conflict_or_missing'};
  if(result.data.length!==1||result.data[0]?.revision!==expectedRevision+1) return {ok:false,kind:'database_error'};
  return {ok:true,revision:result.data[0].revision};
}
