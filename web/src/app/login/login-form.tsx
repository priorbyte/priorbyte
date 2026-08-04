'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { sendMagicLink, type LoginState } from './actions';

const INITIAL: LoginState = { status: 'idle' };

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

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
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');

  async function checkUsername(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setUsernameStatus('idle');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmed)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const supabase = createClient();
    const { data, error } = await supabase.rpc('is_username_available', { candidate: trimmed });
    if (error) {
      setUsernameStatus('idle');
      return;
    }
    // A "taken" result here is only ever a hint — it might just be YOUR
    // existing username if you already have an account. The actual claim
    // attempt in the callback is what decides, not this check.
    setUsernameStatus(data ? 'available' : 'taken');
  }

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
          University email
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

      <div className="space-y-2 text-left">
        <label htmlFor="username" className="pb-label block">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          pattern="[a-zA-Z0-9_]{3,30}"
          autoComplete="username"
          placeholder="e.g. jane_doe"
          onChange={() => setUsernameStatus('idle')}
          onBlur={(e) => void checkUsername(e.target.value)}
          className="w-full rounded-lg border border-line bg-background px-4 py-3 text-white outline-none transition placeholder:text-muted focus:border-cyan/60 focus:shadow-glow"
        />
        {usernameStatus === 'checking' && <p className="text-xs text-muted">Checking…</p>}
        {usernameStatus === 'available' && <p className="text-xs text-teal">Available</p>}
        {usernameStatus === 'taken' && (
          <p className="text-xs text-muted">
            Already in use — that&apos;s fine if it&apos;s yours from a previous sign-in.
          </p>
        )}
        {usernameStatus === 'invalid' && (
          <p className="text-xs text-amber">3-30 characters: letters, numbers, underscores only</p>
        )}
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
