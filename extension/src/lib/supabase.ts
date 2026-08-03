import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@priorbyte/shared/database';
import { chromeStorageAdapter } from './storage-adapter';
import { getConfig } from './config';

let cached: SupabaseClient<Database> | null = null;

/**
 * Shared client for every extension context. Session lives in
 * chrome.storage.local via chromeStorageAdapter, so signing in from the
 * popup makes the background service worker authenticated too.
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (cached) return cached;

  const config = getConfig();
  if (!config) return null;

  cached = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: chromeStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      // The extension has no URL bar to land a redirect on; magic links are
      // exchanged through the popup's own flow instead (see auth.ts).
      detectSessionInUrl: false,
    },
  });

  return cached;
}
