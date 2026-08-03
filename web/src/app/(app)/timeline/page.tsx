import type { Metadata } from 'next';
import { TIMELINE_STAGES, type TimelineStage } from '@priorbyte/shared/constants';
import type { KnowledgeGraphRow, TimelineEntryRow, TopicMasteryRow } from '@priorbyte/shared/database';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';

export const metadata: Metadata = { title: 'Ghost Timeline' };

const STAGE_LABELS: Record<TimelineStage, string> = {
  believed: 'Believed',
  learned: 'Learned',
  practiced: 'Practiced',
  mastered: 'Mastered',
};

function StageTracker({ stage }: { stage: TimelineStage | null }) {
  const currentIndex = stage ? TIMELINE_STAGES.indexOf(stage) : -1;

  return (
    <div className="flex items-center gap-1.5" aria-label={stage ? STAGE_LABELS[stage] : 'Not started'}>
      {TIMELINE_STAGES.map((s, i) => {
        const reached = i <= currentIndex;
        return (
          <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={`h-1.5 w-full rounded-full transition ${reached ? 'bg-cyan' : 'bg-line'}`}
            />
            <span
              className={`font-mono text-[10px] uppercase tracking-wider ${
                reached ? 'text-cyan' : 'text-muted'
              }`}
            >
              {STAGE_LABELS[s]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function TimelinePage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const [{ data: masteryRows }, { data: allTopics }, { data: recentEntries }] = await Promise.all([
    supabase
      .from('topic_mastery')
      .select('*')
      .eq('user_id', profile.id)
      .returns<TopicMasteryRow[]>(),
    supabase
      .from('knowledge_graph')
      .select('id, slug, title, subject, summary, misconceptions, created_at, updated_at')
      .order('subject')
      .order('title')
      .returns<KnowledgeGraphRow[]>(),
    supabase
      .from('timeline_entries')
      .select('*')
      .eq('user_id', profile.id)
      .order('occurred_at', { ascending: false })
      .limit(20)
      .returns<TimelineEntryRow[]>(),
  ]);

  const topics = allTopics ?? [];
  const masteryByTopic = new Map((masteryRows ?? []).map((m) => [m.topic_id, m]));
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const entries = recentEntries ?? [];

  const startedTopicIds = new Set(masteryByTopic.keys());
  const inProgress = topics.filter((t) => startedTopicIds.has(t.id));
  const notStarted = topics.filter((t) => !startedTopicIds.has(t.id));

  const bySubject = (list: KnowledgeGraphRow[]) => {
    const groups = new Map<string, KnowledgeGraphRow[]>();
    for (const topic of list) {
      const group = groups.get(topic.subject) ?? [];
      group.push(topic);
      groups.set(topic.subject, group);
    }
    return groups;
  };

  return (
    <div className="space-y-10">
      <div>
        <p className="pb-label">Ghost Timeline</p>
        <h1 className="mt-2 text-4xl">Believed → Learned → Practiced → Mastered</h1>
        <p className="mt-2 max-w-2xl text-silver">
          Every topic moves through these four stages as Priorbyte sees you engage with it. Stage
          changes come from captured work, not self-report.
        </p>
      </div>

      {inProgress.length > 0 && (
        <section className="space-y-4">
          <h2 className="pb-label">In progress</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {inProgress.map((topic) => {
              const mastery = masteryByTopic.get(topic.id) ?? null;
              return (
                <div key={topic.id} className="pb-panel">
                  <p className="pb-label">{topic.subject}</p>
                  <h3 className="mt-1 text-xl text-white">{topic.title}</h3>
                  <div className="mt-4">
                    <StageTracker stage={mastery?.stage ?? null} />
                  </div>
                  {mastery && (
                    <p className="mt-3 font-mono text-xs text-muted">
                      {Math.round(mastery.confidence * 100)}% confidence · since{' '}
                      {formatWhen(mastery.first_seen_at)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {inProgress.length === 0 && (
        <div className="pb-panel border-cyan/30">
          <h2 className="text-2xl">No topic underway yet</h2>
          <p className="mt-2 max-w-2xl text-silver">
            Topics move onto this timeline the moment Priorbyte sees real engagement with
            them — a captured note, a question, a corrected mistake. Nothing has been captured
            yet, so nothing has started.
          </p>
        </div>
      )}

      <section className="space-y-6">
        <h2 className="pb-label">Not started</h2>
        {[...bySubject(notStarted).entries()].map(([subject, subjectTopics]) => (
          <div key={subject}>
            <p className="mb-2 text-sm text-muted">{subject}</p>
            <div className="flex flex-wrap gap-2">
              {subjectTopics.map((topic) => (
                <span
                  key={topic.id}
                  className="rounded-full border border-line px-4 py-2 text-sm text-silver"
                  title={topic.summary ?? undefined}
                >
                  {topic.title}
                </span>
              ))}
            </div>
          </div>
        ))}
        {notStarted.length === 0 && topics.length > 0 && (
          <p className="text-sm text-muted">Every known topic is already in progress.</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="pb-label">Recent activity</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">
            Stage transitions will appear here in order as they happen.
          </p>
        ) : (
          <ol className="space-y-3">
            {entries.map((entry) => {
              const topic = topicById.get(entry.topic_id);
              return (
                <li key={entry.id} className="pb-panel flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-white">
                      <span className="text-cyan">{STAGE_LABELS[entry.stage]}</span>
                      {topic ? ` — ${topic.title}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-silver">{entry.summary}</p>
                  </div>
                  <span className="whitespace-nowrap font-mono text-xs text-muted">
                    {formatWhen(entry.occurred_at)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
