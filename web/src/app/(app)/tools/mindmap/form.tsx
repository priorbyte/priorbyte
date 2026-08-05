'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { generateMindMap, type MindMapState } from './actions';

const INITIAL: MindMapState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Mapping…' : 'Generate mind map'}
    </button>
  );
}

export function MindMapForm() {
  const [state, formAction] = useFormState(generateMindMap, INITIAL);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <textarea
          name="content"
          rows={10}
          maxLength={20000}
          placeholder="Paste the material to map out…"
          className="w-full rounded-lg border border-line bg-background px-4 py-3 text-sm text-white outline-none transition placeholder:text-muted focus:border-cyan/60"
        />
        <SubmitButton />
        {state.status === 'error' && (
          <p className="text-sm text-amber" role="alert">
            {state.message}
          </p>
        )}
      </form>

      {state.status === 'ok' && state.map && (
        <div className="pb-panel">
          <h2 className="text-2xl text-white">{state.map.topic}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.map.branches.map((branch, i) => (
              <div key={i} className="rounded-lg border border-line bg-background p-4">
                <p className="pb-label text-cyan">{branch.label}</p>
                <ul className="mt-2 space-y-1.5">
                  {branch.children.map((leaf, j) => (
                    <li key={j} className="text-sm text-silver">
                      · {leaf.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
