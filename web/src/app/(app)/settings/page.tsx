import type { Metadata } from 'next';
import { mergeDashboardPreferences } from '@priorbyte/shared/constants';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
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
    <div className="space-y-8">
      <div>
        <p className="pb-label">Settings</p>
        <h1 className="mt-2 text-4xl">Customize your dashboard</h1>
      </div>
      <SettingsForm
        nickname={profile.nickname ?? ''}
        preferences={mergeDashboardPreferences(profile.dashboard_preferences)}
        availableSubjects={availableSubjects}
      />
    </div>
  );
}
