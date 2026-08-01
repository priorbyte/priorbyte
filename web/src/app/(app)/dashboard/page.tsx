import Link from 'next/link';
import type { Metadata } from 'next';
import { TIER_LIMITS } from '@priorbyte/shared/constants';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const [{ count: eventCount }, { count: masteredCount }, { data: remaining }] = await Promise.all([
    supabase
      .from('learning_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id),
    supabase
      .from('topic_mastery')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('stage', 'mastered'),
    supabase.rpc('ai_queries_remaining'),
  ]);

  const limit = TIER_LIMITS[profile.subscription_tier].aiQueriesPerMonth;

  const stats = [
    { label: 'Events captured', value: eventCount ?? 0 },
    { label: 'Topics mastered', value: masteredCount ?? 0 },
    {
      label: 'AI queries left',
      value: limit === null ? '∞' : (remaining ?? limit),
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <p className="pb-label">Dashboard</p>
        <h1 className="mt-2 text-4xl">
          {profile.goal ? 'Working toward' : 'Your cognitive twin'}
        </h1>
        {profile.goal && <p className="mt-2 max-w-2xl text-silver">{profile.goal}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value }) => (
          <div key={label} className="pb-panel">
            <p className="pb-label">{label}</p>
            <p className="mt-3 font-mono text-4xl text-cyan">{value}</p>
          </div>
        ))}
      </div>

      {(eventCount ?? 0) === 0 && (
        <div className="pb-panel border-cyan/30">
          <h2 className="text-2xl">Nothing captured yet</h2>
          <p className="mt-2 max-w-2xl text-silver">
            Priorbyte has no signal to model until it sees you work. Install the capture extension
            and study normally — the timeline fills itself in.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/timeline" className="pb-panel block transition hover:border-cyan/30">
          <h2 className="text-2xl">Ghost Timeline</h2>
          <p className="mt-2 text-sm text-muted">
            Believed → Learned → Practiced → Mastered, per topic.
          </p>
        </Link>
        <Link href="/memory" className="pb-panel block transition hover:border-cyan/30">
          <h2 className="text-2xl">Ghost Memory</h2>
          <p className="mt-2 text-sm text-muted">
            Search your own past mistakes by meaning, not keyword.
          </p>
        </Link>
      </div>
    </div>
  );
}
