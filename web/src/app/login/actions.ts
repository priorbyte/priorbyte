'use server';

import { magicLinkSchema } from '@priorbyte/shared/schemas';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl, isSupabaseConfigured } from '@/lib/supabase/config';

export interface LoginState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
  email?: string;
}

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isSupabaseConfigured()) {
    return { status: 'error', message: 'Supabase is not configured yet on this deployment.' };
  }

  const parsed = magicLinkSchema.safeParse({
    email: formData.get('email'),
    username: formData.get('username'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Enter a valid email and a username (3-30 letters, numbers, or underscores).',
    };
  }

  const next = String(formData.get('next') ?? '/dashboard');
  const callback = new URL('/auth/callback', getSiteUrl());
  // Only relative paths — an absolute `next` would make this an open redirect.
  callback.searchParams.set('next', next.startsWith('/') ? next : '/dashboard');
  // Carried through so a brand-new account can claim it on first sign-in.
  // Deliberately NOT availability-checked here: a returning user typing
  // their own existing username would otherwise get blocked from signing
  // in at all, since we can't tell new-vs-returning before the link is
  // clicked. The callback only claims it if the profile has none yet.
  callback.searchParams.set('username', parsed.data.username);

  const supabase = createClient();

  // App-level rate limit, independent of Supabase's own built-in Auth rate
  // limits — defense in depth, and it lets us give a clear error message
  // instead of a generic one from GoTrue.
  const { data: allowed, error: rateLimitError } = await supabase.rpc(
    'request_magic_link_allowed',
    { target_email: parsed.data.email },
  );

  if (rateLimitError) {
    return { status: 'error', message: 'Could not process that request. Try again shortly.' };
  }

  if (!allowed) {
    return {
      status: 'error',
      message: 'Too many sign-in attempts for this email. Wait a few minutes and try again.',
      email: parsed.data.email,
    };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: callback.toString(),
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { status: 'error', message: error.message, email: parsed.data.email };
  }

  return { status: 'sent', email: parsed.data.email };
}
