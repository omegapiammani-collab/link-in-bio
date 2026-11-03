import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
export async function GET(request:NextRequest) {
 const origin=request.nextUrl.origin;
 const code=request.nextUrl.searchParams.get('code');
 if(!code) return NextResponse.redirect(new URL('/login?error=callback',origin));
 const client=await createSupabaseServerClient();
 const {error}=await client.auth.exchangeCodeForSession(code);
 if(error) return NextResponse.redirect(new URL('/login?error=callback',origin));
 const {data}=await client.auth.getUser();
 if(data.user?.id !== process.env.OWNER_AUTH_USER_ID) {
  await client.auth.signOut();
  return NextResponse.redirect(new URL('/login?error=unauthorized',origin));
 }
 return NextResponse.redirect(new URL('/admin',origin));
}
