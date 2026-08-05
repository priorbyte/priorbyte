'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { simplifyConcept, type SimplifierState } from './actions';

const INITIAL: SimplifierState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Simplifying…' : 'Simplify'}
    </button>
  );
}

export function SimplifierForm() {
  const [state, formAction] = useFormState(simplifyConcept, INITIAL);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={formAction} className="space-y-4">
        <textarea
          name="content"
          rows={6}
          maxLength={5000}
          placeholder="Paste the concept, definition, or paragraph you don't fully get…"
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
        <p className="pb-label">In plain English</p>
        {state.status === 'ok' && state.simplified ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-silver">{state.simplified}</p>
        ) : (
          <p className="mt-3 text-sm text-muted">The simplified version will appear here.</p>
        )}
      </div>
    </div>
  );
}
