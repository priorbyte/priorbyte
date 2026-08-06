'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { signIn, signUp, type AuthState } from './actions';

const INITIAL: AuthState = { status: 'idle' };

type Mode = 'sign-in' | 'sign-up';
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [signInState, signInAction] = useFormState(signIn, INITIAL);
  const [signUpState, signUpAction] = useFormState(signUp, INITIAL);
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
    setUsernameStatus(data ? 'available' : 'taken');
  }

  if (signUpState.status === 'sent') {
    return (
      <div className="pb-panel text-center" role="status">
        <p className="text-xl text-white">Check your inbox</p>
        <p className="mt-3 text-sm text-silver">
          We sent a confirmation link to{' '}
          <span className="font-mono text-cyan">{signUpState.email}</span>. Click it to activate
          your account, then sign in with the password you just set.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-panel space-y-4">
      <div className="flex rounded-lg border border-line p-1">
        <button
          type="button"
          onClick={() => setMode('sign-in')}
          className={`flex-1 rounded-md py-2 text-sm transition ${
            mode === 'sign-in' ? 'bg-cyan/10 text-cyan' : 'text-muted hover:text-silver'
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode('sign-up')}
          className={`flex-1 rounded-md py-2 text-sm transition ${
            mode === 'sign-up' ? 'bg-cyan/10 text-cyan' : 'text-muted hover:text-silver'
          }`}
        >
          Sign up
        </button>
      </div>

      {mode === 'sign-in' ? (
        <form action={signInAction} className="space-y-4">
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
              placeholder="yourname@karunya.edu.in"
              className="w-full rounded-lg border border-line bg-background px-4 py-3 text-white outline-none transition placeholder:text-muted focus:border-cyan/60 focus:shadow-glow"
            />
          </div>
          <div className="space-y-2 text-left">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="pb-label block">
                Password
              </label>
              <Link href="/auth/reset-password" className="text-xs text-cyan hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-line bg-background px-4 py-3 text-white outline-none transition placeholder:text-muted focus:border-cyan/60 focus:shadow-glow"
            />
          </div>
          <SubmitButton label="Sign in" pendingLabel="Signing in…" />
          {signInState.status === 'error' && (
            <p className="text-sm text-amber" role="alert">
              {signInState.message}
            </p>
          )}
        </form>
      ) : (
        <form action={signUpAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2 text-left">
            <label htmlFor="signup-email" className="pb-label block">
              University email
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="yourname@karunya.edu.in"
              className="w-full rounded-lg border border-line bg-background px-4 py-3 text-white outline-none transition placeholder:text-muted focus:border-cyan/60 focus:shadow-glow"
            />
            <p className="text-xs text-muted">
              Students: @karunya.edu.in — Staff: @karunya.edu. Your role is set automatically
              from this.
            </p>
          </div>
          <div className="space-y-2 text-left">
            <label htmlFor="signup-username" className="pb-label block">
              Username
            </label>
            <input
              id="signup-username"
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
              <p className="text-xs text-amber">Already taken</p>
            )}
            {usernameStatus === 'invalid' && (
              <p className="text-xs text-amber">
                3-30 characters: letters, numbers, underscores only
              </p>
            )}
          </div>
          <div className="space-y-2 text-left">
            <label htmlFor="signup-password" className="pb-label block">
              Password
            </label>
            <input
              id="signup-password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-line bg-background px-4 py-3 text-white outline-none transition placeholder:text-muted focus:border-cyan/60 focus:shadow-glow"
            />
          </div>
          <SubmitButton label="Create account" pendingLabel="Creating…" />
          {signUpState.status === 'error' && (
            <p className="text-sm text-amber" role="alert">
              {signUpState.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
