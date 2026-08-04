import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;

/**
 * Magic-link landing point. Exchanges the one-time code for a session cookie,
 * claims the chosen username onto a fresh profile, then routes first-time
 * users through onboarding.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  const usernameParam = searchParams.get('username');
  // Reject absolute URLs — otherwise `next` is an open redirect.
  const next = nextParam?.startsWith('/') ? nextParam : '/dashboard';

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed_at, username')
      .eq('id', user.id)
      .maybeSingle();

    // Only claims onto a profile that has none yet — a returning user's
    // existing username is never overwritten, and this simply no-ops if
    // the desired one was taken by someone else in the meantime (the
    // .is('username', null) guard means the UPDATE just won't apply).
    if (usernameParam && USERNAME_PATTERN.test(usernameParam) && !profile?.username) {
      await supabase
        .from('profiles')
        .update({ username: usernameParam })
        .eq('id', user.id)
        .is('username', null);
    }

    if (!profile?.onboarding_completed_at) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
