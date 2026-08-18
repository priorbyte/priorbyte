import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@priorbyte/shared/database';
import { requireSupabaseConfig } from './supabase/config';

/**
 * Auth for the mobile API routes (web/src/app/api/mobile/*). The mobile app
 * has no cookies to carry a session, so it sends its Supabase access token
 * as a bearer header instead. Building the client with that header means
 * every query below still runs AS that user under RLS -- the same security
 * model as the cookie-based web client, not a service-role bypass.
 */
export async function getMobileUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { supabase: null, user: null } as const;

  const { url, anonKey } = requireSupabaseConfig();
  const supabase = createSupabaseClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user } as const;
}
