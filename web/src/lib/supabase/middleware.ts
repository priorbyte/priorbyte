import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@priorbyte/shared/database';

// Non-optional `options` — see the note in supabase/server.ts.
type CookiesToSet = { name: string; value: string; options: CookieOptions }[];
import { getSupabaseConfig } from './config';

/** Routes reachable without a session. Everything else requires sign-in. */
const PUBLIC_PATHS = ['/', '/login', '/auth'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the auth cookie on every request and gates private routes.
 *
 * Session refresh has to happen in middleware: Server Components cannot write
 * cookies, so without this the token would silently expire mid-session.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const config = getSupabaseConfig();
  // Unconfigured project: let everything through so the setup notice renders
  // rather than bouncing the user around a login page that cannot work.
  if (!config) return response;

  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates against the auth server. Do not swap this for
  // getSession(), which trusts a cookie the client could have forged.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Signed in but still on the login page — send them inward.
  if (user && pathname === '/login') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
