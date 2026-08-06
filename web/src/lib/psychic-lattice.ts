import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  Json,
  KnowledgeGraphRow,
  VulnerabilityModelRow,
} from '@priorbyte/shared/database';
import type { LearningEventType } from '@priorbyte/shared/constants';
import type { VulnerabilityPattern } from '@priorbyte/shared/types';
import { generateJSON } from './gemini';

/**
 * Stand-in for the Section 9 "Psychic Lattice" daily cron. A real cron needs
 * a deployed Edge Function (`supabase login` + `functions deploy`, a
 * separate CLI auth this environment doesn't have) — this runs the same
 * computation inline, triggered when the student visits Ghost Oracle, and
 * skips recomputation if the model is still fresh. Functionally equivalent
 * for a single-user dev/demo context; a real multi-tenant deployment would
 * still want the actual cron so it doesn't wait on a page visit.
 */

const STALE_AFTER_MS = 24 * 60 * 60 * 1000; // "daily" — matches the blueprint's cadence
const MIN_EVENTS_FOR_SIGNAL = 3;
const MAX_EVENTS_ANALYZED = 100;
const SIGNAL_TYPES: LearningEventType[] = ['quiz_attempt', 'correction', 'question', 'note'];

interface RawPattern {
  conceptSlug: string;
  label: string;
  weight: number;
  evidenceCount: number;
  relatedTopicSlugs: string[];
}

const SYSTEM_PROMPT = `You analyze a student's captured learning events (quiz attempts,
corrections, notes, questions) to find recurring MISCONCEPTION PATTERNS — not just topics
they've touched, but specific, repeated ways their reasoning goes wrong. Output 2-6 patterns.
conceptSlug is a short kebab-case identifier you invent for the pattern itself (e.g.
"sign-error-in-derivatives"), not a topic name. weight is 0-1, how strongly the evidence
supports this pattern actually recurring (not how severe it is). evidenceCount is how many
of the input events support it. relatedTopicSlugs must only use slugs from the provided
topic list — never invent one. If there isn't enough real repetition to call something a
pattern, return fewer patterns rather than padding to 6.`;

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      conceptSlug: { type: 'STRING' },
      label: { type: 'STRING' },
      weight: { type: 'NUMBER' },
      evidenceCount: { type: 'INTEGER' },
      relatedTopicSlugs: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['conceptSlug', 'label', 'weight', 'evidenceCount', 'relatedTopicSlugs'],
  },
};

export async function ensureVulnerabilityModel(
  supabase: SupabaseClient<Database>,
  userId: string,
  knownTopics: KnowledgeGraphRow[],
): Promise<VulnerabilityModelRow> {
  const { data: existing } = await supabase
    .from('vulnerability_model')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const isFresh =
    existing && Date.now() - new Date(existing.last_computed_at).getTime() < STALE_AFTER_MS;
  if (existing && isFresh) return existing;

  const { data: events } = await supabase
    .from('learning_events')
    .select('id, type, content')
    .eq('user_id', userId)
    .in('type', SIGNAL_TYPES)
    .order('occurred_at', { ascending: false })
    .limit(MAX_EVENTS_ANALYZED);

  const signal = events ?? [];
  const slugById = new Map(knownTopics.map((t) => [t.slug, t.id]));

  let patterns: Record<string, VulnerabilityPattern> = {};
  let confidence = 0;

  if (signal.length >= MIN_EVENTS_FOR_SIGNAL) {
    const topicList = knownTopics.map((t) => `${t.slug}: ${t.title}`).join('\n');
    const transcript = signal.map((e) => `[${e.type}] ${e.content}`).join('\n---\n');
    const prompt = `Known topics (use only these slugs in relatedTopicSlugs):\n${topicList}\n\nCaptured events:\n${transcript}`;

    const raw = await generateJSON<RawPattern[]>(SYSTEM_PROMPT, prompt, RESPONSE_SCHEMA);
    if (raw) {
      patterns = Object.fromEntries(
        raw.map((p) => [
          p.conceptSlug,
          {
            label: p.label,
            weight: Math.max(0, Math.min(1, p.weight)),
            evidenceCount: p.evidenceCount,
            relatedTopicIds: p.relatedTopicSlugs
              .map((slug) => slugById.get(slug))
              .filter((id): id is string => Boolean(id)),
          },
        ]),
      );
      // Confidence scales with how much signal fed the computation, capped —
      // 3 events is barely enough to call anything a pattern; 30+ is solid.
      confidence = Math.min(1, signal.length / 30);
    }
  }

  const { data: upserted, error } = await supabase
    .from('vulnerability_model')
    .upsert(
      {
        user_id: userId,
        // Record<string, VulnerabilityPattern> is structurally JSON-safe
        // (every field is a string/number/array), but the interface itself
        // has no index signature, so it isn't assignable to Json without
        // this cast — TypeScript can't see the two shapes are compatible.
        patterns: patterns as unknown as Json,
        confidence,
        events_analyzed: signal.length,
        last_computed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single();

  if (error || !upserted) {
    // Fall back to whatever existed before rather than crashing the caller —
    // a stale model is still usable, an error is not.
    return (
      existing ?? {
        id: '',
        user_id: userId,
        patterns: {},
        confidence: 0,
        events_analyzed: 0,
        last_computed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }
    );
  }

  return upserted;
}
