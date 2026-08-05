'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { requestPasswordReset, type ResetState } from './actions';

const INITIAL: ResetState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Sending…' : 'Send reset link'}
    </button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(requestPasswordReset, INITIAL);

  if (state.status === 'sent') {
    return (
      <div className="pb-panel text-center" role="status">
        <p className="text-xl text-white">Check your inbox</p>
        <p className="mt-3 text-sm text-silver">
          If that email has an account, we sent a link to set a new password.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="pb-panel space-y-4">
      <div className="space-y-2 text-left">
        <label htmlFor="email" className="pb-label block">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@university.edu"
          className="w-full rounded-lg border border-line bg-background px-4 py-3 text-white outline-none transition placeholder:text-muted focus:border-cyan/60"
        />
      </div>
      <SubmitButton />
      {state.status === 'error' && (
        <p className="text-sm text-amber" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
