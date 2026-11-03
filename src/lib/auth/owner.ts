import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
/** Fail closed when the sole authorized auth.users UUID is unset. */
export async function getOwner() {
 const expectedId=process.env.OWNER_AUTH_USER_ID;
 if (!expectedId || !/^[0-9a-f-]{36}$/i.test(expectedId) || expectedId==='00000000-0000-0000-0000-000000000000') return null;
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.auth.getUser();
 if (error || !data.user || data.user.id!==expectedId) return null;
 return data.user;
}
