import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicSupabaseEnv } from './env';
export async function createSupabaseServerClient() {
 const cookieStore = await cookies();
 const { url, key } = getPublicSupabaseEnv();
 return createServerClient(url, key, {
  cookies: {
   getAll() { return cookieStore.getAll(); },
   setAll(items) {
    try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
    catch { /* Rendering contexts cannot modify cookies; callback route can. */ }
   },
  },
 });
}
