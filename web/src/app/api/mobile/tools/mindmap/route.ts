import { NextResponse, type NextRequest } from 'next/server';
import { generateJSON, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { getMobileUser } from '@/lib/mobile-auth';

export const dynamic = 'force-dynamic';

interface MindMap {
  topic: string;
  branches: { label: string; children: { label: string }[] }[];
}

const MAX_INPUT_LENGTH = 20_000;

const SYSTEM_PROMPT = `You turn study material into a mind map with exactly three levels: one
root topic, 4-7 major branches under it, and 2-5 leaf points under each branch. Keep every
label to a few words, not full sentences. Never invent content not supported by the input.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    topic: { type: 'STRING' },
    branches: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          children: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: { label: { type: 'STRING' } }, required: ['label'] },
          },
        },
        required: ['label', 'children'],
      },
    },
  },
  required: ['topic', 'branches'],
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

  const map = await generateJSON<MindMap>(SYSTEM_PROMPT, content, RESPONSE_SCHEMA, { task: 'structured' });
  if (!map || !map.branches?.length) {
    return NextResponse.json({ error: 'Could not build a mind map from that.' }, { status: 502 });
  }

  await logAiUsage(supabase, user.id, 'mindmap_generator');
  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'note',
    content,
    source: 'tool_mindmap',
  });

  return NextResponse.json({ map });
}
