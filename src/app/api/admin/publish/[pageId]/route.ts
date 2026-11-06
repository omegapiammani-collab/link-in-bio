import { NextRequest, NextResponse } from 'next/server';
import { getOwner } from '@/lib/auth/owner';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/domain/draft-contract.mjs';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const response=(body:unknown,status:number)=>NextResponse.json(body,{status,headers});
type Params={params:Promise<{pageId:string}>};

export async function POST(request:NextRequest,{params}:Params){
  // Default-off in every environment. No publish exposure without an
  // explicit release-time server flag and a real, verified Owner session.
  if(process.env.PHASE2_PUBLISH_ENABLED!=='true')
    return response({error:'unavailable'},404);
  const {pageId}=await params;
  if(!isUuid(pageId))return response({error:'page_invalid'},400);
  if(!await getOwner())return response({error:'forbidden'},403);
  if(request.headers.get('origin')!==request.nextUrl.origin)
    return response({error:'origin_forbidden'},403);
  const claimedSize=Number(request.headers.get('content-length')??0);
  if(!Number.isSafeInteger(claimedSize)||claimedSize<0||claimedSize>2048)
    return response({error:'payload_too_large'},413);

  let input:unknown;
  try{
    const raw=await request.text();
    if(new TextEncoder().encode(raw).length>2048)return response({error:'payload_too_large'},413);
    input=JSON.parse(raw);
  }catch{return response({error:'invalid_json'},400);}
  if(!input||typeof input!=='object'||Array.isArray(input))
    return response({error:'invalid_body'},400);
  const {expectedRevision,makePublic}=input as Record<string,unknown>;
  if(typeof expectedRevision!=='number'||!Number.isSafeInteger(expectedRevision)||
    expectedRevision<1)return response({error:'revision_invalid'},422);
  if(typeof makePublic!=='boolean')return response({error:'visibility_invalid'},422);

  const db=await createSupabaseServerClient();
  const {data,error}=await db.rpc('publish_page_checked',{
    p_page_id:pageId,p_expected_revision:expectedRevision,p_make_public:makePublic
  }).single();
  if(error){
    if(error.code==='42501')return response({error:'forbidden'},403);
    if(error.message==='revision_conflict')return response({error:'revision_conflict'},409);
    if(error.message==='page_not_publishable')return response({error:'page_not_publishable'},409);
    return response({error:'publish_failed'},500);
  }
  const row=data as {version_id?:unknown;version_number?:unknown}|null;
  if(typeof row?.version_id!=='string'||typeof row.version_number!=='number')
    return response({error:'invalid_server_response'},502);
  return response({versionId:row.version_id,versionNumber:row.version_number,
    visibility:makePublic?'public':'unlisted'},200);
}
