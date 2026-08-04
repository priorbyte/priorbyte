'use server';

import { revalidatePath } from 'next/cache';
import { askGemini, isGeminiConfigured, type ChatTurn } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';

export interface TutorState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
  reply?: string;
  /** Bumped on every successful reply so the client can detect a new one
   * even if, by coincidence, the reply text is identical to the last. */
  nonce?: number;
}

const MAX_MESSAGE_LENGTH = 4000;
const HISTORY_TURNS = 20;

export async function sendTutorMessage(
  conversationId: string,
  _prev: TutorState,
  formData: FormData,
): Promise<TutorState> {
  const content = String(formData.get('content') ?? '').trim();
  if (!content) return { status: 'error', message: 'Type something first.' };
  if (content.length > MAX_MESSAGE_LENGTH) return { status: 'error', message: 'Too long.' };

  if (!isGeminiConfigured()) {
    return { status: 'error', message: 'The AI Tutor is not configured yet on this deployment.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Not signed in.' };

  const { data: remaining, error: quotaError } = await supabase.rpc('ai_queries_remaining');
  if (quotaError) {
    return { status: 'error', message: 'Could not check your quota. Try again shortly.' };
  }
  if (remaining !== null && remaining <= 0) {
    return {
      status: 'error',
      message: "You've used all your AI queries for this month. Upgrade to Pro for unlimited.",
    };
  }

  const { error: userMsgError } = await supabase.from('chat_history').insert({
    user_id: user.id,
    conversation_id: conversationId,
    role: 'user',
    content,
  });
  if (userMsgError) {
    return { status: 'error', message: userMsgError.message };
  }

  const { data: recentHistory } = await supabase
    .from('chat_history')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_TURNS);

  const history: ChatTurn[] = (recentHistory ?? [])
    .reverse()
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content }));

  const reply = await askGemini(history);

  if (!reply) {
    return {
      status: 'error',
      message: 'The AI Tutor is temporarily unavailable. Your message was saved — try again.',
    };
  }

  const { error: replyError } = await supabase.from('chat_history').insert({
    user_id: user.id,
    conversation_id: conversationId,
    role: 'assistant',
    content: reply,
  });
  if (replyError) {
    return { status: 'error', message: replyError.message };
  }

  await supabase.from('ai_usage').insert({
    user_id: user.id,
    feature: 'tutor',
    model: 'gemini-2.0-flash',
  });

  revalidatePath('/tutor');
  revalidatePath('/dashboard');

  return { status: 'ok', reply, nonce: Date.now() };
}
