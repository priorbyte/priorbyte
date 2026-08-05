'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { signInSchema, signUpSchema } from '@priorbyte/shared/schemas';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl, isSupabaseConfigured } from '@/lib/supabase/config';

/**
 * The signup confirmation link has to redirect back to whichever origin the
 * student actually used — not a single fixed value. NEXT_PUBLIC_SITE_URL
 * alone breaks the moment anyone opens the app from something other than
 * that exact host (a LAN IP for testing on a second device, a preview
 * domain, etc.). Falls back to the configured site URL if headers are
 * unavailable.
 */
function getRequestOrigin(): string {
  const h = headers();
  const host = h.get('host');
  if (!host) return getSiteUrl();

  const isLocalNetwork =
    host.startsWith('localhost') || host.startsWith('127.0.0.1') || /^\d+\.\d+\.\d+\.\d+/.test(host);
  const proto = h.get('x-forwarded-proto') ?? (isLocalNetwork ? 'http' : 'https');
  return `${proto}://${host}`;
}

export interface AuthState {
  status: 'idle' | 'sent' | 'error';
  message?: string;
  email?: string;
}

/**
 * Creates the account and sends a confirmation email — this is the one
 * remaining email round-trip, verifying the account rather than being how
 * every sign-in works. Once confirmed, the student signs in with the
 * password they set here.
 */
export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { status: 'error', message: 'Supabase is not configured yet on this deployment.' };
  }

  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    username: formData.get('username'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message:
        'Enter a valid email, a username (3-30 letters/numbers/underscores), and a password of at least 8 characters.',
    };
  }

  const next = String(formData.get('next') ?? '/dashboard');
  const callback = new URL('/auth/callback', getRequestOrigin());
  // Only relative paths — an absolute `next` would make this an open redirect.
  callback.searchParams.set('next', next.startsWith('/') ? next : '/dashboard');
  // Claimed by the callback route onto the new profile once confirmed.
  callback.searchParams.set('username', parsed.data.username);

  const supabase = createClient();

  // App-level rate limit on top of Supabase's own built-in Auth rate limits —
  // reused from the magic-link era; it's just "don't let one email spam
  // itself with auth emails," which applies here too.
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
      message: 'Too many attempts for this email. Wait a few minutes and try again.',
      email: parsed.data.email,
    };
  }

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: callback.toString() },
  });

  if (error) {
    return { status: 'error', message: error.message, email: parsed.data.email };
  }

  return { status: 'sent', email: parsed.data.email };
}

/** Returning-user sign-in: password only, no email round-trip. */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { status: 'error', message: 'Supabase is not configured yet on this deployment.' };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { status: 'error', message: 'Enter your email and password.' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Accounts created before password auth existed (pure magic-link era)
    // have no password set — GoTrue returns "Invalid login credentials"
    // for that exactly like a wrong password, so point at the fix.
    return {
      status: 'error',
      message: `${error.message}. If this account predates password sign-in, use "Forgot password" to set one.`,
      email: parsed.data.email,
    };
  }

  const next = String(formData.get('next') ?? '/dashboard');
  redirect(next.startsWith('/') ? next : '/dashboard');
}
