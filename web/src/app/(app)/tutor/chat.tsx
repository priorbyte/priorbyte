'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { sendTutorMessage, type TutorState } from './actions';

const INITIAL: TutorState = { status: 'idle' };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Thinking…' : 'Send'}
    </button>
  );
}

export function TutorChat({
  conversationId,
  initialMessages,
  queriesRemaining,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  queriesRemaining: number | null;
}) {
  const boundAction = sendTutorMessage.bind(null, conversationId);
  const [state, formAction] = useFormState(boundAction, INITIAL);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [pendingUserText, setPendingUserText] = useState('');
  const lastNonce = useRef<number | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'ok' && state.reply && state.nonce !== lastNonce.current) {
      lastNonce.current = state.nonce;
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${state.nonce}`, role: 'assistant', content: state.reply! },
      ]);
    }
  }, [state]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const formData = new FormData(e.currentTarget);
    const text = String(formData.get('content') ?? '').trim();
    if (!text) {
      e.preventDefault();
      return;
    }
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', content: text }]);
    setPendingUserText('');
    formRef.current?.reset();
  }

  const outOfQueries = queriesRemaining !== null && queriesRemaining <= 0;

  return (
    <div className="flex h-[70vh] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pr-2">
        {messages.length === 0 && (
          <p className="text-sm text-muted">
            Ask about anything you&apos;re stuck on. The tutor sees your conversation, not your
            grades.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
              m.role === 'user'
                ? 'ml-auto bg-cyan/10 text-white'
                : 'pb-panel !p-4 text-silver'
            }`}
          >
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleSubmit}
        className="mt-4 flex gap-2 border-t border-line pt-4"
      >
        <textarea
          name="content"
          rows={2}
          maxLength={4000}
          value={pendingUserText}
          onChange={(e) => setPendingUserText(e.target.value)}
          disabled={outOfQueries}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          placeholder={
            outOfQueries ? "You're out of AI queries this month." : 'Ask a question…'
          }
          className="flex-1 rounded-lg border border-line bg-background px-4 py-3 text-white outline-none transition placeholder:text-muted focus:border-cyan/60 disabled:opacity-50"
        />
        <SendButton />
      </form>

      {state.status === 'error' && (
        <p className="mt-2 text-sm text-amber" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
