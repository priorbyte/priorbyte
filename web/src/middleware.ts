import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, image files, and /api/mobile/* --
     * the mobile app's API routes authenticate via a bearer token
     * (getMobileUser), not the cookie session this middleware manages, and
     * were getting silently redirected to /login (a 307 + HTML page)
     * instead of returning their own JSON 401. A cookie-less native client
     * has no way to follow that redirect meaningfully anyway.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/mobile|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
