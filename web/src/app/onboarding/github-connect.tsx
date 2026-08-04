'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Status = 'checking' | 'connected' | 'not-connected' | 'linking' | 'error';

/**
 * Real GitHub account linking via Supabase's identity-linking API — not a
 * placeholder. Requires two things only the project owner can do in the
 * Supabase dashboard: the GitHub provider configured with a Client ID/Secret,
 * and "Allow manual linking" enabled. Until both are on, linkIdentity()
 * fails with a clear error, which we surface rather than hide.
 */
export function GitHubConnect() {
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUserIdentities().then(({ data, error }) => {
      if (error) {
        setStatus('error');
        setError(error.message);
        return;
      }
      const connected = data?.identities.some((i) => i.provider === 'github') ?? false;
      setStatus(connected ? 'connected' : 'not-connected');
    });
  }, []);

  async function connect() {
    setStatus('linking');
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    });
    if (error) {
      setStatus('error');
      setError(error.message);
    }
    // On success, Supabase redirects the browser to GitHub immediately —
    // there is no further local state to set.
  }

  return (
    <div className="rounded-lg border border-line bg-background p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-white">GitHub</p>
          <p className="mt-1 text-xs text-muted">
            Links commits and repos as learning signal for coding courses.
          </p>
        </div>
        {status === 'connected' ? (
          <span className="rounded-full border border-teal/40 px-3 py-1.5 text-xs text-teal">
            Connected
          </span>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={status === 'linking' || status === 'checking'}
            className="rounded-lg border border-line px-4 py-2 text-sm text-silver transition hover:border-cyan/40 disabled:opacity-50"
          >
            {status === 'linking' ? 'Redirecting…' : 'Connect'}
          </button>
        )}
      </div>
      {status === 'error' && (
        <p className="mt-2 text-xs text-amber" role="alert">
          {error} — GitHub needs to be enabled in the Supabase dashboard first.
        </p>
      )}
    </div>
  );
}
