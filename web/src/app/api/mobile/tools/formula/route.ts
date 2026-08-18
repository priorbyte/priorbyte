import { NextResponse, type NextRequest } from 'next/server';
import { generateText, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { getMobileUser } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

const MAX_INPUT_LENGTH = 2000;

const SYSTEM_PROMPT = `You explain a single formula or equation a student pastes in. Structure
your answer as: (1) what each variable/symbol means, (2) what the formula computes and when
it applies, (3) a fully worked numeric example, (4) the single most common mistake students
make when using it. Be precise about units where relevant. If the input isn't a formula,
say so plainly rather than guessing.`;

export async function POST(request: NextRequest) {
  const { supabase, user } = await getMobileUser(request);
  if (!supabase || !user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!isGeminiConfigured()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content) return NextResponse.json({ error: 'Paste a formula first.' }, { status: 400 });
  if (content.length > MAX_INPUT_LENGTH) return NextResponse.json({ error: 'Too long.' }, { status: 400 });

  const quota = await checkQuota(supabase);
  if (!quota.allowed) return NextResponse.json({ error: quota.message }, { status: 429 });

  const explanation = await generateText(SYSTEM_PROMPT, content);
  if (!explanation) return NextResponse.json({ error: 'Could not explain that just now.' }, { status: 502 });

  await logAiUsage(supabase, user.id, 'formula_explainer');
  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'question',
    content,
    source: 'tool_formula_explainer',
  });

  return NextResponse.json({ explanation });
}
