import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { SetupNotice } from '@/components/setup-notice';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { OnboardingWizard } from './wizard';

export const metadata: Metadata = { title: 'Get set up' };

// Session-dependent — must be rendered per request, never prerendered.
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
        <SetupNotice />
      </main>
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.onboarding_completed_at) redirect('/dashboard');

  const displayName = profile?.display_name?.split(' ')[0] ?? 'student';

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center px-6 py-16">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-blueprint bg-blueprint-grid [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]"
      />
      <OnboardingWizard displayName={displayName} />
    </main>
  );
}
