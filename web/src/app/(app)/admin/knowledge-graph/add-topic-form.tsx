'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createTopic, type AdminActionResult } from './actions';

const INITIAL: AdminActionResult = { ok: true };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Adding…' : 'Add topic'}
    </button>
  );
}

export function AddTopicForm() {
  const [state, formAction] = useFormState(createTopic, INITIAL);

  return (
    <details className="pb-panel">
      <summary className="cursor-pointer text-sm text-white">+ Add a topic</summary>
      <form action={formAction} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            name="title"
            placeholder="Title, e.g. Eigenvalues"
            required
            className="rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
          />
          <input
            name="subject"
            placeholder="Subject, e.g. Linear Algebra"
            required
            className="rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
          />
        </div>
        <textarea
          name="summary"
          rows={2}
          placeholder="Summary (optional)"
          className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
        />
        <textarea
          name="misconceptions"
          rows={3}
          placeholder="Known misconceptions, one per line"
          className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
        />
        <SubmitButton />
        {!state.ok && (
          <p className="text-sm text-amber" role="alert">
            {state.message}
          </p>
        )}
      </form>
    </details>
  );
}
