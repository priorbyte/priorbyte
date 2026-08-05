'use server';

import { generateText, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { createClient } from '@/lib/supabase/server';

export interface SimplifierState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
  simplified?: string;
}

const MAX_INPUT_LENGTH = 5000;

const SYSTEM_PROMPT = `You re-explain a concept a student pastes in, using progressively
simpler language. Structure your answer as: (1) a one-sentence plain-English version, as if
explaining to a smart 12-year-old, (2) a short analogy to something familiar, (3) the same
concept restated with correct technical terminology, so the student can connect the intuition
to the vocabulary they'll actually be tested on. Never oversimplify to the point of being
technically wrong.`;

export async function simplifyConcept(
  _prev: SimplifierState,
  formData: FormData,
): Promise<SimplifierState> {
  const content = String(formData.get('content') ?? '').trim();
  if (!content) return { status: 'error', message: 'Paste a concept first.' };
  if (content.length > MAX_INPUT_LENGTH) return { status: 'error', message: 'Too long.' };

  if (!isGeminiConfigured()) {
    return { status: 'error', message: 'This tool is not configured yet on this deployment.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Not signed in.' };

  const quota = await checkQuota(supabase);
  if (!quota.allowed) {
    return { status: 'error', message: quota.message ?? 'Quota check failed.' };
  }

  const simplified = await generateText(SYSTEM_PROMPT, content);
  if (!simplified) {
    return { status: 'error', message: 'Could not simplify that just now. Try again.' };
  }

  await logAiUsage(supabase, user.id, 'concept_simplifier');

  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'question',
    content,
    source: 'tool_concept_simplifier',
  });

  return { status: 'ok', simplified };
}
