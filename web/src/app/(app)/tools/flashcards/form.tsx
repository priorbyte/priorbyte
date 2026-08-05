'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { generateFlashcards, type FlashcardState } from './actions';

const INITIAL: FlashcardState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Generating…' : 'Generate flashcards'}
    </button>
  );
}

function Card({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      className="pb-panel min-h-[8rem] text-left transition hover:border-cyan/30"
    >
      <p className="pb-label">{flipped ? 'Back' : 'Front'}</p>
      <p className="mt-2 text-sm text-silver">{flipped ? back : front}</p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted">
        Click to flip
      </p>
    </button>
  );
}

export function FlashcardsForm() {
  const [state, formAction] = useFormState(generateFlashcards, INITIAL);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <textarea
          name="content"
          rows={10}
          maxLength={20000}
          placeholder="Paste the material to turn into flashcards…"
          className="w-full rounded-lg border border-line bg-background px-4 py-3 text-sm text-white outline-none transition placeholder:text-muted focus:border-cyan/60"
        />
        <SubmitButton />
        {state.status === 'error' && (
          <p className="text-sm text-amber" role="alert">
            {state.message}
          </p>
        )}
      </form>

      {state.status === 'ok' && state.cards && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.cards.map((card, i) => (
            <Card key={i} front={card.front} back={card.back} />
          ))}
        </div>
      )}
    </div>
  );
}
