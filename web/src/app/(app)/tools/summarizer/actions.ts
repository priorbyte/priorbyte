'use server';

import { generateText, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { createClient } from '@/lib/supabase/server';

export interface SummarizerState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
  summary?: string;
}

const MAX_INPUT_LENGTH = 20_000;

const SYSTEM_PROMPT = `You summarize student notes for fast review before an exam. Output
concise bullet points grouped under short headings, in the same language as the input.
Preserve every formula, date, and defined term exactly. Never invent content that isn't in
the notes.`;

export async function summarizeNotes(
  _prev: SummarizerState,
  formData: FormData,
): Promise<SummarizerState> {
  const content = String(formData.get('content') ?? '').trim();
  if (!content) return { status: 'error', message: 'Paste some notes first.' };
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

  await logAiUsage(supabase, user.id, 'notes_summarizer');

  // Real capture, same as any other learning event — feeds Ghost Memory and
  // the vulnerability model, not just a throwaway tool output.
  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'note',
    content,
    source: 'tool_summarizer',
  });

  return { status: 'ok', summary };
}
