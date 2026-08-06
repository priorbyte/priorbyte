import type { Metadata } from 'next';
import type { GhostForkRow, KnowledgeGraphRow, PredictedErrorRow } from '@priorbyte/shared/database';
import { requireProfile } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { isGeminiConfigured } from '@/lib/gemini';
import { ensureVulnerabilityModel } from '@/lib/psychic-lattice';
import { generatePredictedErrors } from '@/lib/error-oracle';
import { PredictionsList } from './predictions-list';

export const metadata: Metadata = { title: 'Ghost Oracle' };

interface GhostForkStep {
  stage: string;
  summary: string;
  occurredAt: string | null;
}

export default async function OraclePage() {
  const profile = await requireProfile();

  if (!isGeminiConfigured()) {
    return (
      <div className="pb-panel max-w-2xl border-amber/40">
        <p className="pb-label text-amber">Not configured</p>
        <p className="mt-2 text-sm text-silver">
          Set <code className="font-mono text-cyan">GEMINI_API_KEY</code> to enable the Oracle.
        </p>
      </div>
    );
  }

  const supabase = createClient();
  const serviceClient = createServiceRoleClient();

  const { data: allTopics } = await supabase
    .from('knowledge_graph')
    .select('*')
    .returns<KnowledgeGraphRow[]>();
  const topics = allTopics ?? [];
  const topicById = new Map(topics.map((t) => [t.id, t]));

  // The daily Vercel Cron at /api/cron/oracle normally does this for every
  // onboarded account. This inline call is the fallback for a brand-new
  // account visiting before the next cron tick — ensureVulnerabilityModel's
  // 24h freshness check and the pendingCount guard make it a no-op once the
  // cron (or an earlier visit) already covered today.
  const vulnerabilityModel = await ensureVulnerabilityModel(serviceClient, profile.id, topics);

  const { count: pendingCount } = await supabase
    .from('predicted_errors')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('outcome', 'pending');

  if (!pendingCount) {
    await generatePredictedErrors(
      serviceClient,
      profile.id,
      profile.subjects,
      vulnerabilityModel.patterns as Record<string, { label: string; weight: number; evidenceCount: number; relatedTopicIds: string[] }>,
    );
  }

  const [{ data: predictions }, { data: forks }] = await Promise.all([
    supabase
      .from('predicted_errors')
      .select('*')
      .eq('user_id', profile.id)
      .order('predicted_at', { ascending: false })
      .returns<PredictedErrorRow[]>(),
    supabase
      .from('ghost_forks')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .returns<GhostForkRow[]>(),
  ]);

  const patternEntries = Object.entries(
    vulnerabilityModel.patterns as Record<string, { label: string; weight: number }>,
  );

  return (
    <div className="space-y-10">
      <div>
        <p className="pb-label">Ghost Oracle</p>
        <h1 className="mt-2 text-4xl">Predicted before it happens</h1>
        <p className="mt-2 max-w-2xl text-silver">
          Built from your vulnerability model — {vulnerabilityModel.events_analyzed} captured
          events analyzed, {Math.round(vulnerabilityModel.confidence * 100)}% confidence.
        </p>
      </div>

      {patternEntries.length > 0 && (
        <section className="space-y-3">
          <h2 className="pb-label">Detected patterns</h2>
          <div className="flex flex-wrap gap-2">
            {patternEntries.map(([key, p]) => (
              <span
                key={key}
                className="rounded-full border border-line px-4 py-2 text-sm text-silver"
                title={`weight ${p.weight.toFixed(2)}`}
              >
                {p.label}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="pb-label">Predictions</h2>
        <PredictionsList predictions={predictions ?? []} topicById={topicById} />
      </section>

      {forks && forks.length > 0 && (
        <section className="space-y-4">
          <h2 className="pb-label">Ghost Fork — resolved</h2>
          <div className="space-y-4">
            {forks.map((fork) => {
              const topic = topicById.get(fork.topic_id);
              const original = (fork.original_path as unknown as GhostForkStep[]) ?? [];
              const protectedPath = (fork.protected_path as unknown as GhostForkStep[]) ?? [];
              return (
                <div key={fork.id} className="pb-panel">
                  <p className="pb-label">{topic?.title ?? 'Topic'}</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-amber">
                        Without inoculation
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-muted">
                        {original.map((step, i) => (
                          <li key={i}>
                            {step.stage}: {step.summary}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-teal">What happened</p>
                      <ul className="mt-2 space-y-1 text-sm text-silver">
                        {protectedPath.map((step, i) => (
                          <li key={i}>
                            {step.stage}: {step.summary}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
