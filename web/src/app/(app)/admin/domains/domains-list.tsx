'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { AllowedEmailDomainRow } from '@priorbyte/shared/database';
import { addDomain, removeDomain, type AdminActionResult } from './actions';

const INITIAL: AdminActionResult = { ok: true };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Adding…' : 'Add domain'}
    </button>
  );
}

export function DomainsList({ domains }: { domains: AllowedEmailDomainRow[] }) {
  const [state, formAction] = useFormState(addDomain, INITIAL);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <form action={formAction} className="pb-panel flex gap-2">
        <input
          name="domain"
          placeholder="e.g. karunya.edu.in"
          required
          className="flex-1 rounded-lg border border-line bg-background px-4 py-3 text-sm text-white outline-none focus:border-cyan/60"
        />
        <SubmitButton />
      </form>
      {!state.ok && (
        <p className="text-sm text-amber" role="alert">
          {state.message}
        </p>
      )}

      {domains.length === 0 ? (
        <p className="pb-panel text-sm text-muted">
          Empty allowlist means signup is currently open to <strong>any</strong> email domain.
        </p>
      ) : (
        <div className="space-y-2">
          {domains.map((d) => (
            <div key={d.domain} className="pb-panel flex items-center justify-between">
              <span className="font-mono text-sm text-white">{d.domain}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await removeDomain(d.domain);
                    if (!result.ok) setError(result.message ?? 'Failed to remove.');
                  })
                }
                className="rounded-lg border border-amber/40 px-3 py-1.5 text-xs text-amber transition hover:bg-amber/10"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="text-sm text-amber" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
