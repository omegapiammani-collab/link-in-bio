import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { verifyOwnerSession } from '@/lib/auth/owner-policy.mjs';

export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  const origin=request.nextUrl.origin;
  const code=request.nextUrl.searchParams.get('code');
  const redirect=(error:string)=>NextResponse.redirect(
    new URL('/login?error='+error,origin)
  );
  if(!code || code.length>2048)return redirect('callback');
  try{
    const client=await createSupabaseServerClient();
    const exchanged=await client.auth.exchangeCodeForSession(code);
    if(exchanged.error)return redirect('callback');

    // Always verify against real Auth user, never the session cookie alone.
    // The Owner config must be an exact, valid UUID or access fails closed.
    const owner=await verifyOwnerSession(client,process.env.OWNER_AUTH_USER_ID);
    if(!owner){
      await client.auth.signOut();
      return redirect('unauthorized');
    }
    return NextResponse.redirect(new URL('/admin',origin));
  }catch{
    return redirect('callback');
  }
}
