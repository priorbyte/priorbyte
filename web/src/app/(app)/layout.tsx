import { ACCENT_COLOR_VALUES, mergeDashboardPreferences } from '@priorbyte/shared/constants';
import { AppNav } from '@/components/app-nav';
import { SetupNotice } from '@/components/setup-notice';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requireProfile } from '@/lib/auth';
import { signOut } from './actions';

// Every route in this group is per-user and session-gated; prerendering them
// at build time is both wrong and impossible (there is no request to read).
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Without a backend there is no session to gate on. Explain that instead of
  // throwing a 500 at whoever is setting the project up.
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <SetupNotice />
      </main>
    );
  }

  const profile = await requireProfile();
  const displayName =
    profile.nickname ?? profile.display_name?.split(' ')[0] ?? profile.email.split('@')[0] ?? 'you';
  const prefs = mergeDashboardPreferences(profile.dashboard_preferences);

  return (
    // Theme and accent are per-account, so they live here on the signed-in
    // shell rather than the public root layout — CSS variables cascade to
    // every descendant, which is what lets every existing `bg-background`,
    // `text-cyan`, etc. across the app repaint without per-component changes.
    <div
      className="min-h-screen bg-background text-silver"
      data-theme={prefs.theme}
      style={{ '--pb-accent': ACCENT_COLOR_VALUES[prefs.accentColor] } as React.CSSProperties}
    >
      <AppNav
        displayName={displayName}
        tier={profile.subscription_tier}
        role={profile.role}
        signOutAction={signOut}
      >
        {children}
      </AppNav>
    </div>
  );
}
