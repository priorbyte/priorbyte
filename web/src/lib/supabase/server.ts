import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@priorbyte/shared/database';

// `options` is non-optional here on purpose: with exactOptionalPropertyTypes,
// an optional field widens to `| undefined`, which Next's cookies().set()
// refuses as its third argument.
type CookiesToSet = { name: string; value: string; options: CookieOptions }[];
import { requireSupabaseConfig } from './config';

/**
 * Server-side Supabase client for Server Components, Server Actions, and
 * Route Handlers. Still the anon key — RLS is the security boundary, and this
 * client acts as the signed-in user.
 */
export function createClient() {
  const { url, anonKey } = requireSupabaseConfig();
  const cookieStore = cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The middleware refreshes the
          // session on every request, so this is safe to swallow.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS entirely — use only in trusted server
 * code (cron, pipeline writes, usage metering) and never with user input
 * deciding which rows to touch.
 */
export function createServiceRoleClient() {
  const { url } = requireSupabaseConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service-role operations.');
  }

  return createServerClient<Database>(url, serviceKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // Service-role client is stateless; it must never adopt a user session.
      },
    },
  });
}
