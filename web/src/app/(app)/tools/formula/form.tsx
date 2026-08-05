'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { explainFormula, type FormulaState } from './actions';

const INITIAL: FormulaState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Explaining…' : 'Explain'}
    </button>
  );
}

export function FormulaForm() {
  const [state, formAction] = useFormState(explainFormula, INITIAL);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={formAction} className="space-y-4">
        <textarea
          name="content"
          rows={4}
          maxLength={2000}
          placeholder="e.g. F = ma, or the quadratic formula, or Bayes' theorem…"
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
        <p className="pb-label">Explanation</p>
        {state.status === 'ok' && state.explanation ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-silver">{state.explanation}</p>
        ) : (
          <p className="mt-3 text-sm text-muted">The breakdown will appear here.</p>
        )}
      </div>
    </div>
  );
}
