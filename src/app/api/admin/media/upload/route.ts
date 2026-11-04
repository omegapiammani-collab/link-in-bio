import { NextRequest, NextResponse } from 'next/server';
import { getOwner } from '@/lib/auth/owner';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic='force-dynamic';
const MAX_BYTES=5*1024*1024;
const BUCKET='link-in-bio-media';
const fileTypes:Record<string,string>={
  'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'
};
function matchesMagic(bytes:Uint8Array,mime:string){
  if(mime==='image/png')return bytes.length>=8 &&
    [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
  if(mime==='image/jpeg')return bytes.length>=4&&bytes[0]===255&&
    bytes[1]===216&&bytes[2]===255;
  if(mime==='image/gif')return bytes.length>=6&&
    String.fromCharCode(...bytes.slice(0,6)).match(/^GIF8[79]a$/)!==null;
  if(mime==='image/webp')return bytes.length>=12&&
    String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&
    String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  return false;
}
const reply=(error:string,status:number)=>NextResponse.json({error},{
  status,headers:{'Cache-Control':'private, no-store'}
});
export async function POST(request:NextRequest){
  if(process.env.PHASE2_MEDIA_UPLOAD_ENABLED!=='true')
    return reply('unavailable',404);
  const owner=await getOwner();
  if(!owner)return reply('forbidden',403);
  if(request.headers.get('origin')!==request.nextUrl.origin)
    return reply('origin_forbidden',403);
  const mime=request.headers.get('content-type')??'';
  if(!Object.hasOwn(fileTypes,mime))return reply('media_type_invalid',415);
  const declared=Number(request.headers.get('content-length')??0);
  if(!Number.isSafeInteger(declared)||declared>MAX_BYTES||declared<0)
    return reply('payload_too_large',413);
  if(!request.body)return reply('invalid_media',400);
  // Enforce the limit while reading, even if Content-Length is absent or wrong.
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let total=0;
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>MAX_BYTES){
        await reader.cancel();
        return reply('payload_too_large',413);
      }
      chunks.push(value);
    }
  }catch{return reply('read_failed',400);}
  if(total===0)return reply('invalid_media',400);
  const bytes=new Uint8Array(total);
  let position=0;
  for(const part of chunks){bytes.set(part,position);position+=part.length;}
  if(!matchesMagic(bytes,mime))return reply('media_signature_invalid',415);
  const path='profiles/'+owner.id+'/'+crypto.randomUUID()+'.'+fileTypes[mime];
  const db=await createSupabaseServerClient();
  const {error}=await db.storage.from(BUCKET).upload(path,bytes,{
    contentType:mime,upsert:false,cacheControl:'3600'
  });
  if(error)return reply('media_upload_failed',502);
  return NextResponse.json({path,mimeType:mime,sizeBytes:total},{
    status:201,headers:{'Cache-Control':'private, no-store'}
  });
}
