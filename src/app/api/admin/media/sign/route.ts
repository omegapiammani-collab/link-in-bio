import { NextRequest, NextResponse } from 'next/server';
import { getOwner } from '@/lib/auth/owner';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic='force-dynamic';
const reply=(error:string,status:number)=>NextResponse.json({error},{
  status,headers:{'Cache-Control':'private, no-store'}
});
export async function POST(request:NextRequest){
  if(process.env.PHASE2_MEDIA_SIGN_ENABLED!=='true')return reply('unavailable',404);
  const owner=await getOwner();
  if(!owner)return reply('forbidden',403);
  if(request.headers.get('origin')!==request.nextUrl.origin)
    return reply('origin_forbidden',403);
  const declared=Number(request.headers.get('content-length')??0);
  if(!Number.isSafeInteger(declared)||declared>1024||declared<0)
    return reply('payload_too_large',413);
  let input:unknown;
  try{
    const raw=await request.text();
    if(new TextEncoder().encode(raw).length>1024)return reply('payload_too_large',413);
    input=JSON.parse(raw);
  }catch{return reply('invalid_json',400);}
  if(!input||typeof input!=='object'||Array.isArray(input))
    return reply('invalid_body',400);
  const path=(input as {path?:unknown}).path;
  // Only the server-generated per-Owner media namespace is signable.
  const exact=new RegExp('^profiles/'+owner.id+
    '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'+
    '\\.(?:png|jpg|webp|gif)$','i');
  if(typeof path!=='string'||!exact.test(path))return reply('media_path_invalid',422);
  const db=await createSupabaseServerClient();
  const {data,error}=await db.storage.from('link-in-bio-media').createSignedUrl(path,60);
  if(error||typeof data?.signedUrl!=='string')return reply('media_sign_failed',404);
  return NextResponse.json({signedUrl:data.signedUrl,expiresIn:60},{
    status:200,headers:{'Cache-Control':'private, no-store'}
  });
}
