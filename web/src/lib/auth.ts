import { redirect } from 'next/navigation';
import type { ProfileRow } from '@priorbyte/shared/database';
import type { SelfServiceRole } from '@priorbyte/shared/constants';
import { createClient } from '@/lib/supabase/server';

/**
 * Karunya-specific: role is derived from the account's own email domain,
 * not chosen — matches the enforcement in guard_profile_privileges, which
 * rejects the mismatched case regardless of what this returns. This is the
 * UX half (skip the choice, show the right thing); that migration is the
 * half that actually matters.
 */
export function deriveRoleFromEmail(email: string): SelfServiceRole | null {
  const lower = email.toLowerCase();
  if (lower.endsWith('@karunya.edu.in')) return 'student';
  if (lower.endsWith('@karunya.edu')) return 'faculty';
  return null;
}

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
