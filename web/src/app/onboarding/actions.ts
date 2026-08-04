'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  ONBOARDING_DIAGNOSTIC_QUESTIONS,
} from '@priorbyte/shared/constants';
import { onboardingSchema } from '@priorbyte/shared/schemas';
import { createClient } from '@/lib/supabase/server';

export interface OnboardingState {
  status: 'idle' | 'error';
  message?: string;
}

function str(value: FormDataEntryValue | null): string | undefined {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

  const subjects = formData.getAll('subjects').map(String).filter(Boolean);
  const enrolledCourses = formData.getAll('enrolledCourses').map(String).filter(Boolean);

  const diagnosticAnswers = ONBOARDING_DIAGNOSTIC_QUESTIONS.reduce<
    { questionId: string; answer: string }[]
  >((acc, { id }) => {
    const answer = str(formData.get(`diagnostic_${id}`));
    if (answer) acc.push({ questionId: id, answer });
    return acc;
  }, []);

  const parsed = onboardingSchema.safeParse({
    goal: str(formData.get('goal')),
    fullName: str(formData.get('fullName')),
    username: str(formData.get('username')),
    avatarUrl: str(formData.get('avatarUrl')),
    dateOfBirth: str(formData.get('dateOfBirth')),
    phoneNumber: str(formData.get('phoneNumber')),
    role: str(formData.get('role')),
    universityName: str(formData.get('universityName')),
    rollNumber: str(formData.get('rollNumber')),
    department: str(formData.get('department')),
    yearLevel: str(formData.get('yearLevel')),
    enrolledCourses: enrolledCourses.length ? enrolledCourses : undefined,
    subjects: subjects.length ? subjects : undefined,
    alternateEmail: str(formData.get('alternateEmail')),
    timeZone: str(formData.get('timeZone')),
    languagePreference: str(formData.get('languagePreference')),
    notificationPreferences: {
      email: formData.get('notif_email') !== null,
      productUpdates: formData.get('notif_productUpdates') !== null,
      weeklyDigest: formData.get('notif_weeklyDigest') !== null,
    },
    diagnosticAnswers: diagnosticAnswers.length ? diagnosticAnswers : undefined,
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Those answers were not valid. Try again or skip.' };
  }

  const d = parsed.data;

  const { error } = await supabase
    .from('profiles')
    .update({
      goal: d.goal ?? null,
      display_name: d.fullName ?? null,
      username: d.username ?? null,
      avatar_url: d.avatarUrl ?? null,
      date_of_birth: d.dateOfBirth ?? null,
      phone_number: d.phoneNumber ?? null,
      ...(d.role ? { role: d.role } : {}),
      university_name: d.universityName ?? null,
      roll_number: d.rollNumber ?? null,
      department: d.department ?? null,
      year_level: d.yearLevel ?? null,
      enrolled_courses: d.enrolledCourses ?? [],
      subjects: d.subjects ?? [],
      alternate_email: d.alternateEmail ?? null,
      time_zone: d.timeZone ?? 'UTC',
      language_preference: d.languagePreference ?? 'en',
      notification_preferences: d.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    // Unique violation on username is the one field-level conflict a student
    // could hit between the availability check and submit (someone else took
    // it in between) — surface that specifically rather than a raw DB error.
    if (error.code === '23505') {
      return { status: 'error', message: 'That username was just taken. Pick another.' };
    }
    return { status: 'error', message: error.message };
  }

  // Answered diagnostic questions are real signal, not throwaway survey
  // data — capturing them as learning_events means Ghost Memory has
  // something to search and the vulnerability model has a cold-start seed,
  // both before the extension ever records a single event.
  if (d.diagnosticAnswers && d.diagnosticAnswers.length > 0) {
    const questionById = new Map<string, string>(
      ONBOARDING_DIAGNOSTIC_QUESTIONS.map((q) => [q.id, q.question]),
    );
    const events = d.diagnosticAnswers.map(({ questionId, answer }) => ({
      user_id: user.id,
      type: 'answer' as const,
      content: `Q: ${questionById.get(questionId) ?? questionId}\nA: ${answer}`,
      source: 'onboarding_diagnostic',
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
