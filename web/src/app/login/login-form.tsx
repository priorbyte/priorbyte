'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { sendMagicLink, type LoginState } from './actions';

const INITIAL: LoginState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Sending…' : 'Send magic link'}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useFormState(sendMagicLink, INITIAL);

  if (state.status === 'sent') {
    return (
      <div className="pb-panel text-center" role="status">
        <p className="text-xl text-white">Check your inbox</p>
        <p className="mt-3 text-sm text-silver">
          We sent a sign-in link to{' '}
          <span className="font-mono text-cyan">{state.email}</span>. It expires in one hour.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="pb-panel space-y-4">
      <input type="hidden" name="next" value={next} />

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
          className="w-full rounded-lg border border-line bg-background px-4 py-3 text-white outline-none transition placeholder:text-muted focus:border-cyan/60 focus:shadow-glow"
        />
      </div>

      <SubmitButton />

      {state.status === 'error' && (
        <p className="text-sm text-amber" role="alert">
          {state.message}
        </p>
      )}

      <p className="text-center text-xs text-muted">
        No passwords, ever. We email you a one-time link.
      </p>
    </form>
  );
}
