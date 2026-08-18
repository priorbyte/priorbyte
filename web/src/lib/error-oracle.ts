import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, KnowledgeGraphRow } from '@priorbyte/shared/database';
import type { VulnerabilityPattern } from '@priorbyte/shared/types';
import { INOCULATION_FORMATS } from '@priorbyte/shared/constants';
import { generateJSON } from './gemini';

/**
 * Error Oracle + Inoculation Engine combined into one Gemini call per topic
 * — the blueprint treats them as separate pipeline stages, but a prediction
 * without its fix isn't useful to show a student, so generating both
 * together avoids a topic ever sitting predicted-but-uninoculated.
 */

const MAX_TOPICS_PER_RUN = 3; // bounds Gemini calls per page visit, not per day

interface OraclePrediction {
  prediction: string;
  confidence: number;
  patternKey: string | null;
  inoculationFormat: (typeof INOCULATION_FORMATS)[number];
  inoculationContent: string;
}

const SYSTEM_PROMPT = `You are the Priorbyte Error Oracle. Given one topic, its known
misconceptions, and a student's broader vulnerability patterns, predict the SINGLE most
likely mistake this specific student will make on this topic — grounded in their actual
patterns where one applies, or the topic's known misconceptions otherwise. Then write the
inoculation: short content in the given format that would stop the mistake from forming.
A "story" is a narrative example where the mistake happens and is caught. A "puzzle" poses a
question that forces confronting the misconception. An "analogy" maps the correct idea onto
something familiar. A "counterexample" is a case where the tempting-but-wrong approach
visibly fails. Pick whichever format best fits this specific mistake.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    prediction: { type: 'STRING' },
    confidence: { type: 'NUMBER' },
    patternKey: { type: 'STRING', nullable: true },
    inoculationFormat: { type: 'STRING', enum: [...INOCULATION_FORMATS] },
    inoculationContent: { type: 'STRING' },
  },
  required: ['prediction', 'confidence', 'inoculationFormat', 'inoculationContent'],
};

/**
 * Picks topics worth predicting on: whatever the student is actively
 * tracked against (topic_mastery) first, falling back to topics matching
 * their onboarding subjects, and finally the whole seeded graph — always
 * skipping any topic that already has an unresolved prediction, so this
 * never duplicates work across repeated visits.
 */
async function selectCandidateTopics(
  supabase: SupabaseClient<Database>,
  userId: string,
  subjects: string[],
): Promise<KnowledgeGraphRow[]> {
  const [{ data: allTopics }, { data: masteryRows }, { data: pending }] = await Promise.all([
    supabase.from('knowledge_graph').select('*'),
    supabase.from('topic_mastery').select('topic_id').eq('user_id', userId),
    supabase.from('predicted_errors').select('topic_id').eq('user_id', userId).eq('outcome', 'pending'),
  ]);

  const topics = allTopics ?? [];
  const pendingIds = new Set((pending ?? []).map((p) => p.topic_id));
  const available = topics.filter((t) => !pendingIds.has(t.id));

  const trackedIds = new Set((masteryRows ?? []).map((m) => m.topic_id));
  const tracked = available.filter((t) => trackedIds.has(t.id));
  if (tracked.length > 0) return tracked.slice(0, MAX_TOPICS_PER_RUN);

  const bySubject = available.filter((t) =>
    subjects.some((s) => t.subject.toLowerCase().includes(s.toLowerCase())),
  );
  if (bySubject.length > 0) return bySubject.slice(0, MAX_TOPICS_PER_RUN);

  return available.slice(0, MAX_TOPICS_PER_RUN);
}

export async function generatePredictedErrors(
  supabase: SupabaseClient<Database>,
  userId: string,
  subjects: string[],
  patterns: Record<string, VulnerabilityPattern>,
): Promise<number> {
  const candidates = await selectCandidateTopics(supabase, userId, subjects);
  if (candidates.length === 0) return 0;

  const patternSummary = Object.entries(patterns)
    .map(([key, p]) => `${key}: ${p.label} (weight ${p.weight.toFixed(2)})`)
    .join('\n');

  let created = 0;

  for (const topic of candidates) {
    const prompt = `Topic: ${topic.title} (${topic.subject})
Known misconceptions for this topic: ${topic.misconceptions.join('; ') || 'none recorded'}
Student's broader vulnerability patterns:
${patternSummary || 'none yet — not enough captured signal, use the topic misconceptions instead'}`;

    const result = await generateJSON<OraclePrediction>(SYSTEM_PROMPT, prompt, RESPONSE_SCHEMA, {
      task: 'reasoning',
    });
    if (!result) continue;

    const { error } = await supabase.from('predicted_errors').insert({
      user_id: userId,
      topic_id: topic.id,
      prediction: result.prediction,
      pattern_key: result.patternKey,
      confidence: Math.max(0, Math.min(1, result.confidence)),
      inoculation_format: result.inoculationFormat,
      inoculation_content: result.inoculationContent,
      inoculation_delivered_at: new Date().toISOString(),
    });

    if (!error) created += 1;
  }

  return created;
}
