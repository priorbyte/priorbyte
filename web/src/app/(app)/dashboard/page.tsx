import Link from 'next/link';
import type { Metadata } from 'next';
import { TIER_LIMITS, mergeDashboardPreferences, type DashboardWidget } from '@priorbyte/shared/constants';
import type { KnowledgeGraphRow, LearningEventRow, TopicMasteryRow } from '@priorbyte/shared/database';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { AutoRefresh } from '@/components/auto-refresh';
import { computeConsistency, computeStreak, getGreeting, toActiveDateSet } from '@/lib/dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_FIVE_DAYS_MS = 35 * 24 * 60 * 60 * 1000;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Confidence → a color that already exists in the brand palette. */
function confidenceColor(confidence: number): string {
  if (confidence >= 0.75) return 'bg-teal';
  if (confidence >= 0.5) return 'bg-cyan';
  if (confidence >= 0.25) return 'bg-silver';
  return 'bg-amber';
}

function topicsSafe(topics: KnowledgeGraphRow[] | null): KnowledgeGraphRow[] {
  return topics ?? [];
}

function topicsWithStage(
  masteryRows: TopicMasteryRow[] | null,
  topicById: Map<string, KnowledgeGraphRow>,
  stage: TopicMasteryRow['stage'],
): { mastery: TopicMasteryRow; topic: KnowledgeGraphRow }[] {
  return (masteryRows ?? [])
    .filter((m) => m.stage === stage)
    .map((mastery) => {
      const topic = topicById.get(mastery.topic_id);
      return topic ? { mastery, topic } : null;
    })
    .filter((x): x is { mastery: TopicMasteryRow; topic: KnowledgeGraphRow } => x !== null)
    .sort((a, b) => a.mastery.confidence - b.mastery.confidence);
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = createClient();
  const prefs = mergeDashboardPreferences(profile.dashboard_preferences);

  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
  const thirtyFiveDaysAgo = new Date(Date.now() - THIRTY_FIVE_DAYS_MS).toISOString();

  const [
    { data: authData },
    { count: eventCount },
    { data: recentDates },
    { data: recentEvents },
    { data: extensionCapture },
    { data: masteryRows },
    { data: allTopics },
    { data: weeklyEntries },
    { count: problemsSolvedCount },
    { count: mistakesFixedCount },
    { data: remaining },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('learning_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id),
    supabase
      .from('learning_events')
      .select('occurred_at')
      .eq('user_id', profile.id)
      .gte('occurred_at', thirtyFiveDaysAgo)
      .returns<Pick<LearningEventRow, 'occurred_at'>[]>(),
    supabase
      .from('learning_events')
      .select('id, type, content, source, occurred_at')
      .eq('user_id', profile.id)
      .order('occurred_at', { ascending: false })
      .limit(5)
      .returns<LearningEventRow[]>(),
    supabase
      .from('learning_events')
      .select('id')
      .eq('user_id', profile.id)
      .like('source', 'http%')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('topic_mastery')
      .select('*')
      .eq('user_id', profile.id)
      .returns<TopicMasteryRow[]>(),
    supabase
      .from('knowledge_graph')
      .select('id, slug, title, subject, summary, misconceptions, created_at, updated_at')
      .returns<KnowledgeGraphRow[]>(),
    supabase
      .from('timeline_entries')
      .select('topic_id, stage')
      .eq('user_id', profile.id)
      .gte('occurred_at', sevenDaysAgo)
      .in('stage', ['learned', 'practiced', 'mastered']),
    supabase
      .from('learning_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .in('type', ['quiz_attempt', 'code_submission'])
      .gte('occurred_at', sevenDaysAgo),
    supabase
      .from('predicted_errors')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('outcome', 'prevented')
      .gte('resolved_at', sevenDaysAgo),
    supabase.rpc('ai_queries_remaining'),
  ]);

  // --- streak & consistency ---------------------------------------------
  const activeDates = toActiveDateSet((recentDates ?? []).map((r) => r.occurred_at));
  const streak = computeStreak(activeDates);
  const consistency = computeConsistency(activeDates, new Date(profile.created_at));

  // --- integration status --------------------------------------------------
  const githubConnected =
    authData.user?.identities?.some((i) => i.provider === 'github') ?? false;
  const extensionConnected = Boolean(extensionCapture);

  // --- topic mastery, joined against the shared knowledge graph -----------
  const topicById = new Map(topicsSafe(allTopics).map((t) => [t.id, t]));
  const weakTopics = topicsWithStage(masteryRows, topicById, 'believed').slice(0, 5);
  const strongTopics = topicsWithStage(masteryRows, topicById, 'mastered').slice(0, 5);

  const subjectStats = new Map<string, { count: number; totalConfidence: number }>();
  for (const m of masteryRows ?? []) {
    const topic = topicById.get(m.topic_id);
    if (!topic) continue;
    const existing = subjectStats.get(topic.subject) ?? { count: 0, totalConfidence: 0 };
    existing.count += 1;
    existing.totalConfidence += m.confidence;
    subjectStats.set(topic.subject, existing);
  }
  let topSubjects = [...subjectStats.entries()].map(([subject, { count, totalConfidence }]) => ({
    subject,
    count,
    avgConfidence: totalConfidence / count,
  }));
  topSubjects =
    prefs.knowledgeMapSubjects.length > 0
      ? topSubjects.filter((s) => prefs.knowledgeMapSubjects.includes(s.subject))
      : topSubjects.sort((a, b) => b.count - a.count || b.avgConfidence - a.avgConfidence).slice(0, 3);

  // --- weekly snapshot ------------------------------------------------------
  const topicsLearnedThisWeek = new Set((weeklyEntries ?? []).map((e) => e.topic_id)).size;

  const limit = TIER_LIMITS[profile.subscription_tier].aiQueriesPerMonth;
  const greeting = getGreeting(profile.time_zone);
  const firstName =
    profile.nickname ??
    profile.display_name?.split(' ')[0] ??
    profile.username ??
    profile.email.split('@')[0];

  const topStats = [
    { label: 'Current streak', value: `${streak}d` },
    { label: 'Consistency (30d)', value: `${consistency}%` },
    { label: 'AI queries left', value: limit === null ? '∞' : (remaining ?? limit) },
  ];

  const widgets: Record<DashboardWidget, React.ReactNode> = {
    streak: (
      <div className="grid gap-4 sm:grid-cols-3">
        {topStats.map(({ label, value }) => (
          <div key={label} className="pb-panel">
            <p className="pb-label">{label}</p>
            <p className="mt-3 font-mono text-4xl text-cyan">{value}</p>
          </div>
        ))}
      </div>
    ),
    integration_status: (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="pb-panel flex items-center justify-between">
          <div>
            <p className="pb-label">Chrome extension</p>
            <p className="mt-1 text-white">{extensionConnected ? 'Capturing' : 'Not connected'}</p>
          </div>
          <span
            className={`h-2.5 w-2.5 rounded-full ${extensionConnected ? 'bg-teal' : 'bg-line'}`}
          />
        </div>
        <div className="pb-panel flex items-center justify-between">
          <div>
            <p className="pb-label">GitHub</p>
            <p className="mt-1 text-white">{githubConnected ? 'Linked' : 'Not linked'}</p>
          </div>
          <span className={`h-2.5 w-2.5 rounded-full ${githubConnected ? 'bg-teal' : 'bg-line'}`} />
        </div>
      </div>
    ),
    weekly_snapshot: (
      <section className="space-y-4">
        <h2 className="pb-label">This week</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="pb-panel">
            <p className="pb-label">Topics advanced</p>
            <p className="mt-3 font-mono text-3xl text-cyan">{topicsLearnedThisWeek}</p>
          </div>
          <div className="pb-panel">
            <p className="pb-label">Problems solved</p>
            <p className="mt-3 font-mono text-3xl text-cyan">{problemsSolvedCount ?? 0}</p>
          </div>
          <div className="pb-panel">
            <p className="pb-label">Mistakes fixed</p>
            <p className="mt-3 font-mono text-3xl text-cyan">{mistakesFixedCount ?? 0}</p>
          </div>
        </div>
      </section>
    ),
    weak_strong_topics: (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="pb-panel">
          <p className="pb-label text-amber">Needs attention</p>
          {weakTopics.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nothing flagged yet — this fills in as topics get tracked.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {weakTopics.map(({ topic }) => (
                <li key={topic.id} className="flex items-center justify-between text-sm">
                  <span className="text-silver">{topic.title}</span>
                  <span className="font-mono text-xs text-amber">{topic.subject}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="pb-panel">
          <p className="pb-label text-teal">Mastered</p>
          {strongTopics.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No topics mastered yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {strongTopics.map(({ topic }) => (
                <li key={topic.id} className="flex items-center justify-between text-sm">
                  <span className="text-silver">{topic.title}</span>
                  <span className="font-mono text-xs text-teal">{topic.subject}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    ),
    knowledge_map: (
      <section className="space-y-3">
        <h2 className="pb-label">Top subjects</h2>
        {topSubjects.length === 0 ? (
          <p className="text-sm text-muted">
            Subjects show up here once at least one topic has been tracked.
          </p>
        ) : (
          <div className="space-y-2">
            {topSubjects.map(({ subject, count, avgConfidence }) => (
              <div key={subject} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-sm text-silver">{subject}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full ${confidenceColor(avgConfidence)}`}
                    style={{ width: `${Math.round(avgConfidence * 100)}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right font-mono text-xs text-muted">
                  {count} topic{count === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    ),
    mini_timeline: (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="pb-label">Recent activity</h2>
          <Link href="/timeline" className="font-mono text-xs text-cyan hover:underline">
            View full timeline →
          </Link>
        </div>
        {(recentEvents ?? []).length === 0 ? (
          <p className="text-sm text-muted">Captured events will appear here.</p>
        ) : (
          <ul className="space-y-2">
            {(recentEvents ?? []).map((event) => (
              <li key={event.id} className="pb-panel flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-cyan">
                    {event.type}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-silver">{event.content}</p>
                </div>
                <span className="shrink-0 font-mono text-xs text-muted">
                  {timeAgo(event.occurred_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    ),
  };

  const visibleWidgets = prefs.widgetOrder.filter((w) => !prefs.hiddenWidgets.includes(w));

  return (
    <div className="space-y-10">
      <AutoRefresh intervalSeconds={prefs.refreshIntervalSeconds} />

      <div>
        <p className="pb-label">Dashboard</p>
        <h1 className="mt-2 text-4xl">
          {greeting}, {firstName}.
        </h1>
        {profile.goal && <p className="mt-2 max-w-2xl text-silver">{profile.goal}</p>}
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

      {visibleWidgets.map((w) => (
        <div key={w}>{widgets[w]}</div>
      ))}

      {!prefs.proBannerDismissed && profile.subscription_tier === 'free' && (
        <div className="pb-panel flex items-center justify-between gap-4 border-cyan/30">
          <div>
            <p className="text-white">You&apos;re on the Free plan</p>
            <p className="mt-1 text-sm text-muted">
              Pro unlocks unlimited AI queries, daily predictions, and Ghost DNA.
            </p>
          </div>
          <span className="shrink-0 rounded-lg border border-line px-4 py-2 text-sm text-muted">
            Coming soon
          </span>
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
