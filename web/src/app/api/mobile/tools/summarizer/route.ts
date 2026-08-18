import { NextResponse, type NextRequest } from 'next/server';
import { generateText, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { getMobileUser } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

const MAX_INPUT_LENGTH = 20_000;

const SYSTEM_PROMPT = `You summarize student notes for fast review before an exam. Output
concise bullet points grouped under short headings, in the same language as the input.
Preserve every formula, date, and defined term exactly. Never invent content that isn't in
the notes.`;

export async function POST(request: NextRequest) {
  const { supabase, user } = await getMobileUser(request);
  if (!supabase || !user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isGeminiConfigured()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content) return NextResponse.json({ error: 'Paste some notes first.' }, { status: 400 });
  if (content.length > MAX_INPUT_LENGTH) return NextResponse.json({ error: 'Too long.' }, { status: 400 });

  const quota = await checkQuota(supabase);
  if (!quota.allowed) return NextResponse.json({ error: quota.message }, { status: 429 });

  const summary = await generateText(SYSTEM_PROMPT, content);
  if (!summary) return NextResponse.json({ error: 'Could not summarize that just now.' }, { status: 502 });

  await logAiUsage(supabase, user.id, 'notes_summarizer');
  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'note',
    content,
    source: 'tool_summarizer',
  });

  return NextResponse.json({ summary });
}
