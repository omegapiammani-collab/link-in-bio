import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { configuredOwnerId, isVerifiedOwner } from './owner-policy.mjs';

/** Fail closed without a fully valid Owner UUID or verified Auth user. */
export async function getOwner() {
  const expectedId = configuredOwnerId(process.env.OWNER_AUTH_USER_ID);
  if (!expectedId) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (!isVerifiedOwner(expectedId, data?.user, error)) return null;
  return data.user;
}
