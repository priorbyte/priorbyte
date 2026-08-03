import { captureLearningEventSchema, type CaptureLearningEventInput } from '@priorbyte/shared/schemas';
import { getSupabaseClient } from './supabase';

export interface CaptureResult {
  ok: boolean;
  error?: string;
}

/**
 * Single write path for every capture source (content script selections,
 * popup manual notes, future capture types). Validates with the same zod
 * schema the web app uses, so a malformed event never reaches Postgres only
 * to be rejected by a CHECK constraint with a confusing error.
 */
export async function captureLearningEvent(
  input: CaptureLearningEventInput,
): Promise<CaptureResult> {
  const parsed = captureLearningEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid capture payload.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Extension is not configured.' };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase.from('learning_events').insert({
    user_id: user.id,
    type: parsed.data.type,
    content: parsed.data.content,
    source: parsed.data.source ?? null,
    occurred_at: parsed.data.occurredAt ?? new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
