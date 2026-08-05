'use server';

import { headers } from 'next/headers';
import { resetPasswordRequestSchema } from '@priorbyte/shared/schemas';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl, isSupabaseConfigured } from '@/lib/supabase/config';

export interface ResetState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
}

function getRequestOrigin(): string {
  const h = headers();
  const host = h.get('host');
  if (!host) return getSiteUrl();
  const isLocalNetwork =
    host.startsWith('localhost') || host.startsWith('127.0.0.1') || /^\d+\.\d+\.\d+\.\d+/.test(host);
  const proto = h.get('x-forwarded-proto') ?? (isLocalNetwork ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Always returns "sent" regardless of whether the email exists — a
 * different message for unknown emails would let anyone enumerate which
 * addresses have accounts.
 */
export async function requestPasswordReset(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  if (!isSupabaseConfigured()) {
    return { status: 'error', message: 'Supabase is not configured yet on this deployment.' };
  }

  const parsed = resetPasswordRequestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { status: 'error', message: 'Enter a valid email address.' };
  }

  const callback = new URL('/auth/callback', getRequestOrigin());
  callback.searchParams.set('next', '/auth/update-password');

  const supabase = createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callback.toString(),
  });

  return { status: 'sent' };
}
