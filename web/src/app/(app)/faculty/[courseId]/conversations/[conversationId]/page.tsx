import Link from 'next/link';
import type { Metadata } from 'next';
import type { ChatConversationRow, ChatHistoryRow } from '@priorbyte/shared/database';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Faculty · Conversation' };

export default async function FacultyConversationPage({
  params,
}: {
  params: { courseId: string; conversationId: string };
}) {
  await requireProfile();
  const supabase = createClient();

  const [{ data: conversation }, { data: messages }] = await Promise.all([
    supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', params.conversationId)
      .maybeSingle<ChatConversationRow>(),
    supabase
      .from('chat_history')
      .select('*')
      .eq('conversation_id', params.conversationId)
      .order('created_at', { ascending: true })
      .returns<ChatHistoryRow[]>(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/faculty/${params.courseId}`}
          className="font-mono text-xs text-cyan hover:underline"
        >
          ← Roster
        </Link>
        <h1 className="mt-3 text-3xl">{conversation?.title ?? 'Untitled conversation'}</h1>
      </div>

      {!conversation || (messages ?? []).length === 0 ? (
        <p className="text-sm text-muted">
          This conversation isn&apos;t visible to you — either it was revoked, or you aren&apos;t
          staff on its course.
        </p>
      ) : (
        <div className="space-y-3">
          {(messages ?? []).map((m) => (
            <div
              key={m.id}
              className={`pb-panel ${m.role === 'assistant' ? 'border-cyan/20' : ''}`}
            >
              <p className="pb-label">{m.role}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-silver">{m.content}</p>
              <p className="mt-2 font-mono text-xs text-muted">
                {new Date(m.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
