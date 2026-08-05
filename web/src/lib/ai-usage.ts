import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@priorbyte/shared/database';

/**
 * Shared quota gate for every AI-backed feature (Tutor, Learning Tools).
 * Checked server-side via the ai_queries_remaining RPC — never trust a
 * client-side counter for something that costs real API tokens.
 */
export async function checkQuota(
  supabase: SupabaseClient<Database>,
): Promise<{ allowed: boolean; message?: string }> {
  const { data: remaining, error } = await supabase.rpc('ai_queries_remaining');
  if (error) {
    return { allowed: false, message: 'Could not check your quota. Try again shortly.' };
  }
  if (remaining !== null && remaining <= 0) {
    return {
      allowed: false,
      message: "You've used all your AI queries for this month. Upgrade to Pro for unlimited.",
    };
  }
  return { allowed: true };
}

export async function logAiUsage(
  supabase: SupabaseClient<Database>,
  userId: string,
  feature: string,
): Promise<void> {
  await supabase.from('ai_usage').insert({
    user_id: userId,
    feature,
    model: 'gemini-flash-latest',
  });
}
