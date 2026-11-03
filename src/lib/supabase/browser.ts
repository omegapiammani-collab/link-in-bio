import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseEnv } from './env';
export function createSupabaseBrowserClient() {
 const {url,key}=getPublicSupabaseEnv();
 return createBrowserClient(url,key);
}
