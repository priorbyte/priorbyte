'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { onboardingSchema } from '@priorbyte/shared/schemas';
import { createClient } from '@/lib/supabase/server';

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

  const parsed = onboardingSchema.safeParse({
    ...(rawGoal ? { goal: rawGoal } : {}),
    ...(rawSubjects.length ? { subjects: rawSubjects } : {}),
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
