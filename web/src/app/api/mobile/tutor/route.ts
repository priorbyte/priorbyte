import { NextResponse, type NextRequest } from 'next/server';
import { TIER_LIMITS } from '@priorbyte/shared/constants';
import type { ProfileRow } from '@priorbyte/shared/database';
import { askGemini, isGeminiConfigured, type ChatTurn } from '@/lib/gemini';
import { getMobileUser } from '@/lib/mobile-auth';

/**
 * Mobile equivalent of web/src/app/(app)/tutor/{page,actions}.tsx. Server
 * actions only work from Next.js form submissions, not an external HTTP
 * client, so this is the real endpoint the Expo app calls -- same
 * conversation/quota/logging logic, ported to a route handler.
 */

export const dynamic = 'force-dynamic';

const CONVERSATION_TITLE = 'AI Tutor';
const MAX_MESSAGE_LENGTH = 4000;
const HISTORY_TURNS = 20;

async function getOrCreateConversation(
  supabase: NonNullable<Awaited<ReturnType<typeof getMobileUser>>['supabase']>,
  userId: string,
) {
  let { data: conversation } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('user_id', userId)
    .is('course_id', null)
    .eq('title', CONVERSATION_TITLE)
    .maybeSingle();

  if (!conversation) {
    const { data: created } = await supabase
      .from('chat_conversations')
      .insert({ user_id: userId, title: CONVERSATION_TITLE })
      .select('id')
      .single();
    conversation = created;
  }
  return conversation;
}

/** Fetch conversation history + quota — the Tutor screen's initial load. */
export async function GET(request: NextRequest) {
  const { supabase, user } = await getMobileUser(request);
  if (!supabase || !user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const conversation = await getOrCreateConversation(supabase, user.id);
  if (!conversation) {
    return NextResponse.json({ error: 'Could not start a conversation.' }, { status: 500 });
  }

  const [{ data: history }, { data: remaining }, { data: profile }] = await Promise.all([
    supabase
      .from('chat_history')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true }),
    supabase.rpc('ai_queries_remaining'),
    supabase.from('profiles').select('subscription_tier').eq('id', user.id).single<
      Pick<ProfileRow, 'subscription_tier'>
    >(),
  ]);

  const limit = profile ? TIER_LIMITS[profile.subscription_tier].aiQueriesPerMonth : null;

  return NextResponse.json({
    conversationId: conversation.id,
    messages: history ?? [],
    queriesRemaining: remaining,
    queriesLimit: limit,
    configured: isGeminiConfigured(),
  });
}

/** Send a message, get the Tutor's reply — mirrors sendTutorMessage exactly. */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getMobileUser(request);
  if (!supabase || !user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: 'The AI Tutor is not configured yet.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content) return NextResponse.json({ error: 'Type something first.' }, { status: 400 });
  if (content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: 'Message too long.' }, { status: 400 });
  }

  const conversation = await getOrCreateConversation(supabase, user.id);
  if (!conversation) {
    return NextResponse.json({ error: 'Could not start a conversation.' }, { status: 500 });
  }

  const { data: remaining, error: quotaError } = await supabase.rpc('ai_queries_remaining');
  if (quotaError) {
    return NextResponse.json({ error: 'Could not check your quota.' }, { status: 500 });
  }
  if (remaining !== null && remaining <= 0) {
    return NextResponse.json(
      { error: "You've used all your AI queries for this month. Upgrade to Pro for unlimited." },
      { status: 429 },
    );
  }

  const { error: userMsgError } = await supabase.from('chat_history').insert({
    user_id: user.id,
    conversation_id: conversation.id,
    role: 'user',
    content,
  });
  if (userMsgError) {
    return NextResponse.json({ error: userMsgError.message }, { status: 500 });
  }

  const { data: recentHistory } = await supabase
    .from('chat_history')
    .select('role, content')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_TURNS);

  const history: ChatTurn[] = (recentHistory ?? [])
    .reverse()
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content }));

  const reply = await askGemini(history);
  if (!reply) {
    return NextResponse.json(
      { error: 'The AI Tutor is temporarily unavailable. Your message was saved — try again.' },
      { status: 502 },
    );
  }

  const { error: replyError } = await supabase.from('chat_history').insert({
    user_id: user.id,
    conversation_id: conversation.id,
    role: 'assistant',
    content: reply,
  });
  if (replyError) {
    return NextResponse.json({ error: replyError.message }, { status: 500 });
  }

  await supabase.from('ai_usage').insert({
    user_id: user.id,
    feature: 'tutor',
    model: 'gemini-flash-latest',
  });

  return NextResponse.json({ reply });
}
