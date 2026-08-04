'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { captureTestNote, type CaptureState } from './actions';

const INITIAL: CaptureState = { status: 'idle' };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-cyan/40 px-4 py-2 text-sm text-cyan transition hover:bg-cyan/10 disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Capture'}
    </button>
  );
}

/** Manual capture, mainly for trying Ghost Memory before the extension is loaded. */
export function CaptureForm() {
  const [state, formAction] = useFormState(captureTestNote, INITIAL);

  return (
    <details className="pb-panel">
      <summary className="cursor-pointer text-sm text-silver">
        No extension yet? Capture something manually to test search.
      </summary>
      <form action={formAction} className="mt-4 space-y-3">
        <textarea
          name="content"
          rows={2}
          maxLength={20000}
          placeholder="e.g. Forgot the chain rule again on the composite function problem."
          className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
        />
        <div className="flex items-center gap-3">
          <SaveButton />
          {state.status === 'saved' && <span className="text-sm text-teal">Captured.</span>}
          {state.status === 'error' && (
            <span className="text-sm text-amber" role="alert">
              {state.message}
            </span>
          )}
        </div>
      </form>
    </details>
  );
}
