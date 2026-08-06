import type { Metadata } from 'next';
import type { KnowledgeGraphRow, TimelineEntryRow, TopicMasteryRow } from '@priorbyte/shared/database';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { computeGhostScoreSeries } from '@/lib/ghost-score';
import { ScoreChart } from './score-chart';

export const metadata: Metadata = { title: 'Ghost Score' };

function scoreColor(score: number): string {
  if (score >= 75) return 'text-teal';
  if (score >= 50) return 'text-cyan';
  if (score >= 25) return 'text-silver';
  return 'text-amber';
}

export default async function GhostScorePage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const [{ data: timelineEntries }, { data: resolvedPredictions }, { data: masteryRows }, { data: topics }] =
    await Promise.all([
      supabase
        .from('timeline_entries')
        .select('topic_id, stage, occurred_at')
        .eq('user_id', profile.id)
        .order('occurred_at', { ascending: true })
        .returns<Pick<TimelineEntryRow, 'topic_id' | 'stage' | 'occurred_at'>[]>(),
      supabase
        .from('predicted_errors')
        .select('outcome, resolved_at')
        .eq('user_id', profile.id)
        .in('outcome', ['prevented', 'occurred'])
        .not('resolved_at', 'is', null),
      supabase.from('topic_mastery').select('*').eq('user_id', profile.id).returns<TopicMasteryRow[]>(),
      supabase
        .from('knowledge_graph')
        .select('id, slug, title, subject, summary, misconceptions, created_at, updated_at')
        .returns<KnowledgeGraphRow[]>(),
    ]);

  const resolved = (resolvedPredictions ?? [])
    .filter((p): p is { outcome: 'prevented' | 'occurred'; resolved_at: string } => p.resolved_at !== null)
    .map((p) => ({ outcome: p.outcome, resolvedAt: p.resolved_at }));

  const { series, current } = computeGhostScoreSeries(timelineEntries ?? [], resolved);

  const topicById = new Map((topics ?? []).map((t) => [t.id, t]));
  const subjectScores = new Map<string, { total: number; count: number }>();
  for (const m of masteryRows ?? []) {
    const topic = topicById.get(m.topic_id);
    if (!topic) continue;
    const stageValue = { believed: 1, learned: 2, practiced: 3, mastered: 4 }[m.stage];
    const existing = subjectScores.get(topic.subject) ?? { total: 0, count: 0 };
    existing.total += (stageValue / 4) * 100;
    existing.count += 1;
    subjectScores.set(topic.subject, existing);
  }
  const bySubject = [...subjectScores.entries()]
    .map(([subject, { total, count }]) => ({ subject, score: Math.round(total / count) }))
    .sort((a, b) => b.score - a.score);

  const preventedCount = resolved.filter((p) => p.outcome === 'prevented').length;
  const occurredCount = resolved.filter((p) => p.outcome === 'occurred').length;

  return (
    <div className="space-y-8">
      <div>
        <p className="pb-label">Ghost Score</p>
        <h1 className="mt-2 text-4xl">A single number for how you&apos;re doing.</h1>
        <p className="mt-2 max-w-2xl text-silver">
          Reconstructed from real stage changes and resolved predictions — not a guess, a replay of
          what actually happened.
        </p>
      </div>

      <div className="pb-panel grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col justify-center">
          <p className="pb-label">Current score</p>
          <p className={`mt-2 font-mono text-6xl ${scoreColor(current)}`}>{current}</p>
          <div className="mt-3 flex gap-4 font-mono text-xs text-muted">
            <span className="text-teal">{preventedCount} prevented</span>
            <span className="text-amber">{occurredCount} occurred</span>
          </div>
        </div>
        <div>
          {series.length < 2 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted">
              Not enough tracked activity yet to plot a trend — keep studying and this fills in.
            </div>
          ) : (
            <ScoreChart series={series} />
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="pb-label">By subject</h2>
        {bySubject.length === 0 ? (
          <p className="text-sm text-muted">Subjects show up here once topics are tracked.</p>
        ) : (
          <div className="space-y-2">
            {bySubject.map(({ subject, score }) => (
              <div key={subject} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-sm text-silver">{subject}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full bg-cyan" style={{ width: `${score}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-xs text-muted">{score}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
