'use server';

import { generateJSON, isGeminiConfigured } from '@/lib/gemini';
import { checkQuota, logAiUsage } from '@/lib/ai-usage';
import { createClient } from '@/lib/supabase/server';

export interface Flashcard {
  front: string;
  back: string;
}

export interface FlashcardState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
  cards?: Flashcard[];
}

const MAX_INPUT_LENGTH = 20_000;

const SYSTEM_PROMPT = `You turn study material into flashcards. Each card's front is a short
question or term; the back is a concise, accurate answer or definition. Produce 8-15 cards
covering the most exam-relevant content. Never invent facts not supported by the input.`;

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      front: { type: 'STRING' },
      back: { type: 'STRING' },
    },
    required: ['front', 'back'],
  },
};

export async function generateFlashcards(
  _prev: FlashcardState,
  formData: FormData,
): Promise<FlashcardState> {
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

  const cards = await generateJSON<Flashcard[]>(SYSTEM_PROMPT, content, RESPONSE_SCHEMA, {
    task: 'structured',
  });
  if (!cards || cards.length === 0) {
    return { status: 'error', message: 'Could not generate flashcards from that. Try again.' };
  }

  await logAiUsage(supabase, user.id, 'flashcard_generator');

  await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'note',
    content,
    source: 'tool_flashcards',
  });

  return { status: 'ok', cards };
}
