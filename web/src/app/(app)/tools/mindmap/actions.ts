'use server';

import { generateJSON, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { createClient } from '@/lib/supabase/server';

export interface MindMapLeaf {
  label: string;
}

export interface MindMapBranch {
  label: string;
  children: MindMapLeaf[];
}

export interface MindMap {
  topic: string;
  branches: MindMapBranch[];
}

export interface MindMapState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
  map?: MindMap;
}

const MAX_INPUT_LENGTH = 20_000;

const SYSTEM_PROMPT = `You turn study material into a mind map with exactly three levels: one
root topic, 4-7 major branches under it, and 2-5 leaf points under each branch. Keep every
label to a few words, not full sentences. Never invent content not supported by the input.`;

// Two fixed levels rather than a recursive schema: Gemini's structured
// output doesn't support self-referential/recursive schemas, so a real
// tree of arbitrary depth isn't expressible here. Root -> branch -> leaf
// is enough for a study mind map without that complexity.
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
            items: {
              type: 'OBJECT',
              properties: { label: { type: 'STRING' } },
              required: ['label'],
            },
          },
        },
        required: ['label', 'children'],
      },
    },
  },
  required: ['topic', 'branches'],
};

export async function generateMindMap(
  _prev: MindMapState,
  formData: FormData,
): Promise<MindMapState> {
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

  const map = await generateJSON<MindMap>(SYSTEM_PROMPT, content, RESPONSE_SCHEMA, {
    task: 'structured',
  });
  if (!map || !map.branches?.length) {
    return { status: 'error', message: 'Could not build a mind map from that. Try again.' };
  }

  await logAiUsage(supabase, user.id, 'mindmap_generator');

  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'note',
    content,
    source: 'tool_mindmap',
  });

  return { status: 'ok', map };
}
