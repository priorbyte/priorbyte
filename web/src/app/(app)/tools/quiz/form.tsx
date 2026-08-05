'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { generateQuiz, type QuizQuestion, type QuizState } from './actions';
import { recordQuizAttempt } from './attempt-actions';

const INITIAL: QuizState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Generating…' : 'Generate quiz'}
    </button>
  );
}

function Question({ q, index }: { q: QuizQuestion; index: number }) {
  const [selected, setSelected] = useState<number | null>(null);

  function choose(i: number) {
    if (selected !== null) return;
    setSelected(i);
    void recordQuizAttempt(
      q.question,
      q.options[i] ?? '',
      q.options[q.correctIndex] ?? '',
      i === q.correctIndex,
      q.explanation,
    );
  }

  return (
    <div className="pb-panel">
      <p className="pb-label">Question {index + 1}</p>
      <p className="mt-2 text-white">{q.question}</p>
      <div className="mt-4 space-y-2">
        {q.options.map((option, i) => {
          const isSelected = selected === i;
          const isCorrect = i === q.correctIndex;
          const revealed = selected !== null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={revealed}
              className={`block w-full rounded-lg border px-4 py-2.5 text-left text-sm transition ${
                revealed && isCorrect
                  ? 'border-teal bg-teal/10 text-teal'
                  : revealed && isSelected
                    ? 'border-amber bg-amber/10 text-amber'
                    : 'border-line text-silver hover:border-cyan/40'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <p className="mt-3 text-sm text-muted">{q.explanation}</p>
      )}
    </div>
  );
}

export function QuizForm() {
  const [state, formAction] = useFormState(generateQuiz, INITIAL);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <textarea
          name="content"
          rows={10}
          maxLength={20000}
          placeholder="Paste the material to quiz yourself on…"
          className="w-full rounded-lg border border-line bg-background px-4 py-3 text-sm text-white outline-none transition placeholder:text-muted focus:border-cyan/60"
        />
        <SubmitButton />
        {state.status === 'error' && (
          <p className="text-sm text-amber" role="alert">
            {state.message}
          </p>
        )}
      </form>

      {state.status === 'ok' && state.questions && (
        <div className="space-y-4">
          {state.questions.map((q, i) => (
            <Question key={i} q={q} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
