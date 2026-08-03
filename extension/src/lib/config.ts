/**
 * Plasmo inlines `process.env.PLASMO_PUBLIC_*` at build time. Config is
 * resolved once and treated as absent (not a crash) so the popup can show a
 * setup notice before a Supabase project exists.
 */
export interface ExtensionConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
}

export function getConfig(): ExtensionConfig | null {
  const supabaseUrl = process.env.PLASMO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY;
  const siteUrl = process.env.PLASMO_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  if (!supabaseUrl || !supabaseAnonKey) return null;
  return { supabaseUrl, supabaseAnonKey, siteUrl };
}
