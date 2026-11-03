'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
export function LoginButton() {
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 async function signIn(){
  setError('');setBusy(true);
  const redirectTo=new URL('/auth/callback', window.location.origin).toString();
  try {
   const {error}=await createSupabaseBrowserClient().auth.signInWithOAuth({provider:'google',options:{redirectTo}});
   if(error) setError('ไม่สามารถเข้าสู่ระบบได้ กรุณาลองอีกครั้ง');
  } catch {setError('ยังไม่ได้ตั้งค่า Supabase หรือการเชื่อมต่อมีปัญหา');}
  finally {setBusy(false);}
 }
 return <div className="space-y-3"><button disabled={busy} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50" onClick={signIn}>{busy?'กำลังเชื่อมต่อ...':'เข้าสู่ระบบด้วย Google'}</button>{error&&<p role="alert" className="text-red-700">{error}</p>}</div>;
}
