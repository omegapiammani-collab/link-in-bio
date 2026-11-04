import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { configuredOwnerId, verifyOwnerSession } from './owner-policy.mjs';

/** Fail closed without a verified Supabase Auth session and exact Owner UUID. */
export async function getOwner() {
  const expectedId = configuredOwnerId(process.env.OWNER_AUTH_USER_ID);
  if (!expectedId) return null;
  try {
    const supabase = await createSupabaseServerClient();
    return await verifyOwnerSession(supabase, expectedId);
  } catch {
    // Missing Supabase configuration and transient SSR failures never grant access.
    return null;
  }
}
