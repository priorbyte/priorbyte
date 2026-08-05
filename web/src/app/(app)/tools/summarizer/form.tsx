'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { summarizeNotes, type SummarizerState } from './actions';

const INITIAL: SummarizerState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Summarizing…' : 'Summarize'}
    </button>
  );
}

export function SummarizerForm() {
  const [state, formAction] = useFormState(summarizeNotes, INITIAL);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={formAction} className="space-y-4">
        <textarea
          name="content"
          rows={16}
          maxLength={20000}
          placeholder="Paste your notes here…"
          className="w-full rounded-lg border border-line bg-background px-4 py-3 text-sm text-white outline-none transition placeholder:text-muted focus:border-cyan/60"
        />
        <SubmitButton />
        {state.status === 'error' && (
          <p className="text-sm text-amber" role="alert">
            {state.message}
          </p>
        )}
      </form>

      <div className="pb-panel">
        <p className="pb-label">Summary</p>
        {state.status === 'ok' && state.summary ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-silver">{state.summary}</p>
        ) : (
          <p className="mt-3 text-sm text-muted">Your summary will appear here.</p>
        )}
      </div>
    </div>
  );
}
