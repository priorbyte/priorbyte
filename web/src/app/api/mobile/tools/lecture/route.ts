import { NextResponse, type NextRequest } from 'next/server';
import { generateText, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { getMobileUser } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

const MAX_INPUT_LENGTH = 60_000;

const SYSTEM_PROMPT = `You summarize a lecture transcript for a student who attended but wants
a clean review. Structure your answer as: (1) a chronological outline of what was covered, in
the order the lecturer presented it, (2) key definitions and formulas introduced, called out
exactly as stated, (3) any worked examples the lecturer walked through, (4) a 3-sentence "if
you only remember this" recap at the end. Ignore filler, tangents, and administrative
announcements (assignment due dates, logistics) unless they're academically substantive.`;

export async function POST(request: NextRequest) {
  const { supabase, user } = await getMobileUser(request);
  if (!supabase || !user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isGeminiConfigured()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content) return NextResponse.json({ error: 'Paste a transcript first.' }, { status: 400 });
  if (content.length > MAX_INPUT_LENGTH) return NextResponse.json({ error: 'Too long.' }, { status: 400 });

  const quota = await checkQuota(supabase);
  if (!quota.allowed) return NextResponse.json({ error: quota.message }, { status: 429 });

  const summary = await generateText(SYSTEM_PROMPT, content);
  if (!summary) return NextResponse.json({ error: 'Could not summarize that just now.' }, { status: 502 });

  await logAiUsage(supabase, user.id, 'lecture_summarizer');
  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'reading',
    content,
    source: 'tool_lecture_summarizer',
  });

  return NextResponse.json({ summary });
}
