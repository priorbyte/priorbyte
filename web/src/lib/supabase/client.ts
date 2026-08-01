'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@priorbyte/shared/database';
import { requireSupabaseConfig } from './config';

/** Browser-side Supabase client. Uses the anon key; RLS does the rest. */
export function createClient() {
  const { url, anonKey } = requireSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
}
