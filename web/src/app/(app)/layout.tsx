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
  const displayName = profile.display_name?.split(' ')[0] ?? profile.email.split('@')[0] ?? 'you';

  return (
    <div className="min-h-screen">
      <AppNav
        displayName={displayName}
        tier={profile.subscription_tier}
        signOutAction={signOut}
      />
      <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
    </div>
  );
}
