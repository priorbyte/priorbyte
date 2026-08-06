'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createCourse, type AdminActionResult } from './actions';

const INITIAL: AdminActionResult = { ok: true };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Creating…' : 'Create course'}
    </button>
  );
}

export function CreateCourseForm() {
  const [state, formAction] = useFormState(createCourse, INITIAL);

  return (
    <details className="pb-panel">
      <summary className="cursor-pointer text-sm text-white">+ Create a course</summary>
      <form action={formAction} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            name="code"
            placeholder="Code, e.g. CS201"
            required
            className="rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
          />
          <input
            name="title"
            placeholder="Title, e.g. Data Structures"
            required
            className="rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
          />
        </div>
        <input
          name="institution"
          placeholder="Institution (optional)"
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
