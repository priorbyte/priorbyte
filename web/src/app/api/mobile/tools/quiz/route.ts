import { NextResponse, type NextRequest } from 'next/server';
import { generateJSON, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { getMobileUser } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
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

export async function POST(request: NextRequest) {
  const { supabase, user } = await getMobileUser(request);
  if (!supabase || !user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isGeminiConfigured()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content) return NextResponse.json({ error: 'Paste some material first.' }, { status: 400 });
  if (content.length > MAX_INPUT_LENGTH) return NextResponse.json({ error: 'Too long.' }, { status: 400 });

  const quota = await checkQuota(supabase);
  if (!quota.allowed) return NextResponse.json({ error: quota.message }, { status: 429 });

  const questions = await generateJSON<QuizQuestion[]>(SYSTEM_PROMPT, content, RESPONSE_SCHEMA, {
    task: 'structured',
  });
  const valid = (questions ?? []).filter((q) => Array.isArray(q.options) && q.options.length === 4);
  if (valid.length === 0) {
    return NextResponse.json({ error: 'Could not generate a quiz from that.' }, { status: 502 });
  }

  await logAiUsage(supabase, user.id, 'quiz_generator');
  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'note',
    content,
    source: 'tool_quiz',
  });

  return NextResponse.json({ questions: valid });
}
