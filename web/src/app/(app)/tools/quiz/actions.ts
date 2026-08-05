'use server';

import { generateJSON, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { createClient } from '@/lib/supabase/server';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
  questions?: QuizQuestion[];
}

const MAX_INPUT_LENGTH = 20_000;

const SYSTEM_PROMPT = `You write multiple-choice quiz questions from study material. Produce
5-10 questions, each with exactly 4 options where exactly one is correct. correctIndex is the
0-based index of the correct option. The explanation says briefly why the correct answer is
right AND names the specific misconception behind the most tempting wrong option. Never invent
facts not supported by the input.`;

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      question: { type: 'STRING' },
      options: { type: 'ARRAY', items: { type: 'STRING' } },
      correctIndex: { type: 'INTEGER' },
      explanation: { type: 'STRING' },
    },
    required: ['question', 'options', 'correctIndex', 'explanation'],
  },
};

export async function generateQuiz(
  _prev: QuizState,
  formData: FormData,
): Promise<QuizState> {
  const content = String(formData.get('content') ?? '').trim();
  if (!content) return { status: 'error', message: 'Paste some material first.' };
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

  const questions = await generateJSON<QuizQuestion[]>(SYSTEM_PROMPT, content, RESPONSE_SCHEMA);
  const valid = (questions ?? []).filter(
    (q) => Array.isArray(q.options) && q.options.length === 4,
  );
  if (valid.length === 0) {
    return { status: 'error', message: 'Could not generate a quiz from that. Try again.' };
  }

  await logAiUsage(supabase, user.id, 'quiz_generator');

  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'note',
    content,
    source: 'tool_quiz',
  });

  return { status: 'ok', questions: valid };
}
