import { getSupabaseClient } from './supabase';

/**
 * Extension auth uses the email OTP *code* rather than a magic-link URL.
 * A clicked link in Gmail opens a normal browser tab, which has no way to
 * hand a session back to the extension — but a 6-digit code, typed into the
 * popup, works from any context and needs no redirect at all.
 *
 * Requires the Supabase "Magic Link" email template to include {{ .Token }}
 * (Auth → Email Templates in the dashboard) — off by default.
 */

export async function requestCode(email: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Extension is not configured.' };

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  return { error: error?.message ?? null };
}

export async function verifyCode(
  email: string,
  token: string,
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: 'Extension is not configured.' };

  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase?.auth.signOut();
}
