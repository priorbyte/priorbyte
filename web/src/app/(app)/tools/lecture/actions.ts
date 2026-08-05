'use server';

import { generateText, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { createClient } from '@/lib/supabase/server';

export interface LectureState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
  summary?: string;
}

const MAX_INPUT_LENGTH = 60_000;

const SYSTEM_PROMPT = `You summarize a lecture transcript for a student who attended but wants
a clean review. Structure your answer as: (1) a chronological outline of what was covered, in
the order the lecturer presented it, (2) key definitions and formulas introduced, called out
exactly as stated, (3) any worked examples the lecturer walked through, (4) a 3-sentence "if
you only remember this" recap at the end. Ignore filler, tangents, and administrative
announcements (assignment due dates, logistics) unless they're academically substantive.`;

export async function summarizeLecture(
  _prev: LectureState,
  formData: FormData,
): Promise<LectureState> {
  const content = String(formData.get('content') ?? '').trim();
  if (!content) return { status: 'error', message: 'Paste a transcript first.' };
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

  const summary = await generateText(SYSTEM_PROMPT, content);
  if (!summary) {
    return { status: 'error', message: 'Could not summarize that just now. Try again.' };
  }

  await logAiUsage(supabase, user.id, 'lecture_summarizer');

  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'reading',
    content,
    source: 'tool_lecture_summarizer',
  });

  return { status: 'ok', summary };
}
