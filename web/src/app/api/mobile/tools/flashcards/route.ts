import { NextResponse, type NextRequest } from 'next/server';
import { generateJSON, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { getMobileUser } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

interface Flashcard {
  front: string;
  back: string;
}

const MAX_INPUT_LENGTH = 20_000;

const SYSTEM_PROMPT = `You turn study material into flashcards. Each card's front is a short
question or term; the back is a concise, accurate answer or definition. Produce 8-15 cards
covering the most exam-relevant content. Never invent facts not supported by the input.`;

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: { front: { type: 'STRING' }, back: { type: 'STRING' } },
    required: ['front', 'back'],
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

  const cards = await generateJSON<Flashcard[]>(SYSTEM_PROMPT, content, RESPONSE_SCHEMA, {
    task: 'structured',
  });
  if (!cards || cards.length === 0) {
    return NextResponse.json({ error: 'Could not generate flashcards from that.' }, { status: 502 });
  }

  await logAiUsage(supabase, user.id, 'flashcard_generator');
  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'note',
    content,
    source: 'tool_flashcards',
  });

  return NextResponse.json({ cards });
}
