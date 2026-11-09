import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { validExternalUrl } from '@/lib/domain/draft-contract.mjs';

export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>};
type LinkEntry={id:string;title:string;url:string;active:boolean};
type Snapshot={slug:string;visibility:'public'|'unlisted';name:string;description:string;links:LinkEntry[]};
function validSnapshot(value:unknown):value is Snapshot{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const p=value as Record<string,unknown>;
  return typeof p.slug==='string'&&
    (p.visibility==='public'||p.visibility==='unlisted')&&typeof p.name==='string'&&
    typeof p.description==='string'&&Array.isArray(p.links);
}
const readPublishedProfile=cache(async(slug:string):Promise<Snapshot|null>=>{
  if(process.env.PHASE2_PUBLIC_RENDER_ENABLED!=='true'||
    !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug))return null;
  const db=await createSupabaseServerClient();
  const {data,error}=await db.rpc('read_published_profile',{p_slug:slug});
  return error||!validSnapshot(data)?null:data;
});
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const profile=await readPublishedProfile((await params).slug);
  if(!profile)return {robots:{index:false,follow:false}};
  return {
    title:profile.name,
    description:profile.description||undefined,
    robots:profile.visibility==='unlisted'?{index:false,follow:false}:undefined
  };
}
export default async function PublicProfile({params}:Props){
  const data=await readPublishedProfile((await params).slug);
  if(!data)notFound();
  const links=data.links.filter(link=>link&&typeof link==='object'&&
    link.active===true&&typeof link.title==='string'&&
    typeof link.url==='string'&&validExternalUrl(link.url));
  return <main className="mx-auto max-w-lg px-5 py-16 text-center space-y-6">
    <header className="space-y-3">
      <h1 className="text-3xl font-bold break-words">{data.name}</h1>
      {data.description&&<p className="text-slate-600 whitespace-pre-wrap">{data.description}</p>}
    </header>
    <ul className="space-y-3">
      {links.map(link=><li key={link.id}>
        <a href={link.url} target="_blank" rel="noopener noreferrer nofollow"
          className="block rounded-xl border px-5 py-4 font-medium hover:bg-slate-50 break-words">
          {link.title}
        </a>
      </li>)}
    </ul>
    <footer className="pt-8 text-sm text-slate-500"><Link href="/">Link-in-Bio</Link></footer>
  </main>;
}
