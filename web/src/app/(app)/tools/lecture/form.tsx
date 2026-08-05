'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { summarizeLecture, type LectureState } from './actions';

const INITIAL: LectureState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Summarizing…' : 'Summarize lecture'}
    </button>
  );
}

export function LectureForm() {
  const [state, formAction] = useFormState(summarizeLecture, INITIAL);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <textarea
          name="content"
          rows={14}
          maxLength={60000}
          placeholder="Paste the lecture transcript here — recording auto-transcripts, shared notes, whatever you've got…"
          className="w-full rounded-lg border border-line bg-background px-4 py-3 text-sm text-white outline-none transition placeholder:text-muted focus:border-cyan/60"
        />
        <SubmitButton />
        {state.status === 'error' && (
          <p className="text-sm text-amber" role="alert">
            {state.message}
          </p>
        )}
      </form>

      {state.status === 'ok' && state.summary && (
        <div className="pb-panel">
          <p className="pb-label">Lecture review</p>
          <p className="mt-3 whitespace-pre-wrap text-sm text-silver">{state.summary}</p>
        </div>
      )}
    </div>
  );
}
