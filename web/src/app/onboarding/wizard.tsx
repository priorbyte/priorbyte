'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { completeOnboarding, skipOnboarding, type OnboardingState } from './actions';

const INITIAL: OnboardingState = { status: 'idle' };

const SUBJECTS = [
  'Calculus',
  'Linear Algebra',
  'Statistics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Data Structures',
  'Algorithms',
  'Economics',
  'Machine Learning',
  'Electronics',
] as const;

const STEPS = ['Goal', 'Extension', 'Subjects', 'Diagnostic'] as const;

/** Five quick questions. Answers are advisory — the model learns from real work. */
const DIAGNOSTIC = [
  'When you get a question wrong, what usually went wrong first?',
  'Which subject do you re-read most often without it sticking?',
  'Do you prefer worked examples or first principles?',
  'What is the last thing you understood, then forgot?',
  'When are you most likely to be studying?',
] as const;

function Dots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      {STEPS.map((s, i) => (
        <span
          key={s}
          className={`h-1 w-10 rounded-full transition ${i <= current ? 'bg-cyan' : 'bg-line'}`}
        />
      ))}
    </div>
  );
}

function FinishButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Finish setup'}
    </button>
  );
}

export function OnboardingWizard({ displayName }: { displayName: string }) {
  const [step, setStep] = useState(0);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [state, formAction] = useFormState(completeOnboarding, INITIAL);

  const toggleSubject = (subject: string) =>
    setSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject],
    );

  const isLast = step === STEPS.length - 1;

  return (
    <form action={formAction} className="w-full max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <Dots current={step} />
        <span className="pb-label">
          Step {step + 1} / {STEPS.length}
        </span>
      </div>

      {/* Hidden inputs carry state from earlier steps through to submit. */}
      {subjects.map((s) => (
        <input key={s} type="hidden" name="subjects" value={s} />
      ))}

      <div className="pb-panel min-h-[22rem]">
        {step === 0 && (
          <div className="space-y-4">
            <h1 className="text-3xl">Welcome, {displayName}.</h1>
            <p className="text-silver">
              What are you working toward? One sentence is plenty — it shapes what Priorbyte
              watches for.
            </p>
            <textarea
              name="goal"
              rows={3}
              maxLength={500}
              placeholder="Pass my calculus final without losing marks to careless algebra."
              className="w-full rounded-lg border border-line bg-background px-4 py-3 text-white outline-none transition placeholder:text-muted focus:border-cyan/60"
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-3xl">Install the capture extension</h1>
            <p className="text-silver">
              Priorbyte learns from real work, not quizzes about your work. The Chrome extension
              quietly records learning events as you study — no page content leaves your account.
            </p>
            <div className="rounded-lg border border-line bg-background p-4">
              <p className="pb-label">Chrome Web Store</p>
              <p className="mt-2 text-sm text-muted">
                Not published yet. Load it unpacked from{' '}
                <code className="font-mono text-cyan">/extension</code> during development.
              </p>
            </div>
            <p className="text-sm text-muted">You can install it later from Settings.</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-3xl">What are you studying?</h1>
            <p className="text-silver">Pick any that apply. This seeds your knowledge graph.</p>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((subject) => {
                const active = subjects.includes(subject);
                return (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => toggleSubject(subject)}
                    aria-pressed={active}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      active
                        ? 'border-cyan bg-cyan/10 text-cyan'
                        : 'border-line text-silver hover:border-cyan/40'
                    }`}
                  >
                    {subject}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h1 className="text-3xl">Five quick questions</h1>
            <p className="text-silver">
              Optional. Skipping costs you nothing — the model learns far more from your actual
              work than from these.
            </p>
            <ul className="space-y-3">
              {DIAGNOSTIC.map((q, i) => (
                <li key={q} className="rounded-lg border border-line bg-background p-3">
                  <span className="font-mono text-xs text-cyan">
                    Q{String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="mt-1 text-sm text-silver">{q}</p>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">
              The interactive diagnostic ships with the AI tutor — for now, finishing here is
              enough.
            </p>
          </div>
        )}
      </div>

      {state.status === 'error' && (
        <p className="text-sm text-amber" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="font-mono text-xs uppercase tracking-[0.2em] text-muted transition hover:text-silver disabled:invisible"
        >
          ← Back
        </button>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void skipOnboarding()}
            className="font-mono text-xs uppercase tracking-[0.2em] text-muted transition hover:text-silver"
          >
            Skip all
          </button>

          {isLast ? (
            <FinishButton />
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="rounded-lg border border-cyan/40 px-6 py-3 font-display text-cyan transition hover:bg-cyan/10"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
