import { redirect } from 'next/navigation';
import type { ProfileRow } from '@priorbyte/shared/database';
import { createClient } from '@/lib/supabase/server';

/**
 * Resolves the signed-in user's profile, or bounces to the right place.
 * Middleware already blocks anonymous access; this is the belt to that braces,
 * and it also enforces the onboarding gate.
 */
export async function requireProfile(): Promise<ProfileRow> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  // The signup trigger creates this row; a miss means the migrations have not
  // been applied to this project yet.
  if (!profile) redirect('/onboarding');
  if (!profile.onboarding_completed_at) redirect('/onboarding');

  return profile;
}
