'use server';

import { revalidatePath } from 'next/cache';
import type { SubscriptionTier, UserRole } from '@priorbyte/shared/constants';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export interface AdminActionResult {
  ok: boolean;
  message?: string;
}

/**
 * Uses the admin's own session-scoped client, not service role — the new
 * "profiles: admin updates all" RLS policy plus guard_profile_privileges'
 * existing is_admin() bypass are what actually make this legal, so the real
 * enforcement lives in Postgres regardless of what this function does.
 */
export async function updateUserRole(
  targetUserId: string,
  role: UserRole,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (targetUserId === admin.id && role !== 'admin') {
    return { ok: false, message: "Can't demote yourself from here." };
  }

  const supabase = createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', targetUserId);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/users');
  return { ok: true };
}

export async function updateUserTier(
  targetUserId: string,
  subscriptionTier: SubscriptionTier,
): Promise<AdminActionResult> {
  await requireAdmin();

  const supabase = createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_tier: subscriptionTier })
    .eq('id', targetUserId);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/users');
  return { ok: true };
}
