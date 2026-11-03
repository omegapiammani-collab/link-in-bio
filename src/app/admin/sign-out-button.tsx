'use client';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
export function SignOutButton(){const router=useRouter();return <button className="rounded-lg border border-slate-300 px-4 py-2" onClick={async()=>{await createSupabaseBrowserClient().auth.signOut();router.replace('/login');router.refresh();}}>ออกจากระบบ</button>;}
