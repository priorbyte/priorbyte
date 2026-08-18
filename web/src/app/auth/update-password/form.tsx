'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { PasswordInput } from '@/components/password-input';
import { updatePassword, type UpdatePasswordState } from './actions';

const INITIAL: UpdatePasswordState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Set password'}
    </button>
  );
}

export function UpdatePasswordForm() {
  const [state, formAction] = useFormState(updatePassword, INITIAL);

  return (
    <form action={formAction} className="pb-panel space-y-4">
      <div className="space-y-2 text-left">
        <label htmlFor="password" className="pb-label block">
          New password
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
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
