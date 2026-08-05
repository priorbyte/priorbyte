/**
 * Supabase configuration, resolved once.
 *
 * The app must boot and render even before the Supabase project exists, so
 * missing config is a first-class state rather than a crash: pages show a
 * setup notice instead of a stack trace.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

/** Throws with an actionable message — use only where config is a hard requirement. */
export function requireSupabaseConfig(): SupabaseConfig {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY in web/.env.local (see .env.example).',
    );
  }
  return config;
}

/** Fallback origin for auth email redirects, when request headers aren't available. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}
