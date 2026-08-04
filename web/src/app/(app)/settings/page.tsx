import type { Metadata } from 'next';
import { mergeDashboardPreferences } from '@priorbyte/shared/constants';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from './profile-form';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: subjectRows } = await supabase
    .from('knowledge_graph')
    .select('subject')
    .order('subject');

  const availableSubjects = [...new Set((subjectRows ?? []).map((r) => r.subject))];

  return (
    <div className="space-y-14">
      <div>
        <p className="pb-label">Settings</p>
        <h1 className="mt-2 text-4xl">Your profile</h1>
        <p className="mt-2 max-w-2xl text-silver">
          Everything you set during onboarding, editable — except role, which is locked once.
        </p>
      </div>
      <ProfileForm profile={profile} userId={profile.id} />

      <div className="border-t border-line pt-14">
        <h1 className="text-4xl">Customize your dashboard</h1>
        <SettingsForm
          nickname={profile.nickname ?? ''}
          preferences={mergeDashboardPreferences(profile.dashboard_preferences)}
          availableSubjects={availableSubjects}
        />
      </div>
    </div>
  );
}
