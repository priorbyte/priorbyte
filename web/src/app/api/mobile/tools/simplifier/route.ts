import { NextResponse, type NextRequest } from 'next/server';
import { generateText, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { getMobileUser } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

const MAX_INPUT_LENGTH = 5000;

const SYSTEM_PROMPT = `You re-explain a concept a student pastes in, using progressively
simpler language. Structure your answer as: (1) a one-sentence plain-English version, as if
explaining to a smart 12-year-old, (2) a short analogy to something familiar, (3) the same
concept restated with correct technical terminology, so the student can connect the intuition
to the vocabulary they'll actually be tested on. Never oversimplify to the point of being
technically wrong.`;

export async function POST(request: NextRequest) {
  const { supabase, user } = await getMobileUser(request);
  if (!supabase || !user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isGeminiConfigured()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content) return NextResponse.json({ error: 'Paste a concept first.' }, { status: 400 });
  if (content.length > MAX_INPUT_LENGTH) return NextResponse.json({ error: 'Too long.' }, { status: 400 });

  const quota = await checkQuota(supabase);
  if (!quota.allowed) return NextResponse.json({ error: quota.message }, { status: 429 });

  const simplified = await generateText(SYSTEM_PROMPT, content);
  if (!simplified) return NextResponse.json({ error: 'Could not simplify that just now.' }, { status: 502 });

  await logAiUsage(supabase, user.id, 'concept_simplifier');
  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'question',
    content,
    source: 'tool_concept_simplifier',
  });

  return NextResponse.json({ simplified });
}
