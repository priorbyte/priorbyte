'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { onboardingSchema } from '@priorbyte/shared/schemas';
import { createClient } from '@/lib/supabase/server';
import { DIAGNOSTIC } from './diagnostic';

export interface OnboardingState {
  status: 'idle' | 'error';
  message?: string;
}

/**
 * Persists whatever the student chose to give us and marks onboarding done.
 * Every field is optional by design — the wizard is entirely skippable, so
 * "finished with nothing filled in" is a valid, complete outcome.
 */
export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const rawSubjects = formData.getAll('subjects').map(String).filter(Boolean);
  const rawGoal = String(formData.get('goal') ?? '').trim();

  const rawDiagnosticAnswers = DIAGNOSTIC.map(({ id }) => ({
    questionId: id,
    answer: String(formData.get(`diagnostic_${id}`) ?? '').trim(),
  })).filter((a) => a.answer.length > 0);

  const parsed = onboardingSchema.safeParse({
    ...(rawGoal ? { goal: rawGoal } : {}),
    ...(rawSubjects.length ? { subjects: rawSubjects } : {}),
    ...(rawDiagnosticAnswers.length ? { diagnosticAnswers: rawDiagnosticAnswers } : {}),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Those answers were not valid. Try again or skip.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      goal: parsed.data.goal ?? null,
      subjects: parsed.data.subjects ?? [],
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    return { status: 'error', message: error.message };
  }

  // Answered diagnostic questions are real signal, not throwaway survey
  // data — capturing them as learning_events means Ghost Memory has
  // something to search and the vulnerability model has a cold-start seed,
  // both before the extension ever records a single event.
  if (parsed.data.diagnosticAnswers?.length) {
    const questionById = new Map<string, string>(DIAGNOSTIC.map((d) => [d.id, d.question]));
    const events = parsed.data.diagnosticAnswers.map(({ questionId, answer }) => ({
      user_id: user.id,
      type: 'answer' as const,
      content: `Q: ${questionById.get(questionId) ?? questionId}\nA: ${answer}`,
      source: 'onboarding_diagnostic',
      occurred_at: new Date().toISOString(),
    }));

    const { error: eventsError } = await supabase.from('learning_events').insert(events);
    if (eventsError) {
      // Non-fatal: onboarding itself succeeded, and losing five self-report
      // answers is not worth blocking someone from reaching their dashboard.
      console.error('Failed to store diagnostic answers as learning events:', eventsError);
    }
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

/** "Skip everything" — records completion without storing any answers. */
export async function skipOnboarding(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', user.id);

  revalidatePath('/dashboard');
  redirect('/dashboard');
}
