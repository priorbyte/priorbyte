import type { Metadata } from 'next';
import { TIER_LIMITS } from '@priorbyte/shared/constants';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isGeminiConfigured } from '@/lib/gemini';
import { TutorChat, type ChatMessage } from './chat';

export const metadata: Metadata = { title: 'AI Tutor' };

const CONVERSATION_TITLE = 'AI Tutor';

export default async function TutorPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  if (!isGeminiConfigured()) {
    return (
      <div className="pb-panel max-w-2xl border-amber/40">
        <p className="pb-label text-amber">AI Tutor not configured</p>
        <p className="mt-2 text-sm text-silver">
          Set <code className="font-mono text-cyan">GEMINI_API_KEY</code> in{' '}
          <code className="font-mono">web/.env.local</code> and restart the dev server.
        </p>
      </div>
    );
  }

  // One continuous conversation per student for now — no course context,
  // so it's never eligible for staff sharing regardless of consent settings.
  let { data: conversation } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('user_id', profile.id)
    .is('course_id', null)
    .eq('title', CONVERSATION_TITLE)
    .maybeSingle();

  if (!conversation) {
    const { data: created } = await supabase
      .from('chat_conversations')
      .insert({ user_id: profile.id, title: CONVERSATION_TITLE })
      .select('id')
      .single();
    conversation = created;
  }

  if (!conversation) {
    return (
      <div className="pb-panel max-w-2xl border-amber/40">
        <p className="text-sm text-amber">Could not start a conversation. Try reloading.</p>
      </div>
    );
  }

  const { data: history } = await supabase
    .from('chat_history')
    .select('id, role, content')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true });

  const { data: remaining } = await supabase.rpc('ai_queries_remaining');
  const limit = TIER_LIMITS[profile.subscription_tier].aiQueriesPerMonth;

  const initialMessages: ChatMessage[] = (history ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="pb-label">AI Tutor</p>
          <h1 className="mt-2 text-4xl">Ask anything you&apos;re stuck on</h1>
        </div>
        <span className="font-mono text-xs text-muted">
          {limit === null ? 'Unlimited queries' : `${remaining ?? limit} / ${limit} left this month`}
        </span>
      </div>

      <TutorChat
        conversationId={conversation.id}
        initialMessages={initialMessages}
        queriesRemaining={limit === null ? null : (remaining ?? limit)}
      />
    </div>
  );
}
