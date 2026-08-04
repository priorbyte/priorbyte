'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ONBOARDING_DIAGNOSTIC_QUESTIONS } from '@priorbyte/shared/constants';
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
 * Full name, university, and roll number are required — enforced here too,
 * not just client-side, since a request can always bypass the wizard's own
 * JS validation. Everything else stays optional. Username is deliberately
 * NOT read from this form: it's collected at sign-up and claimed in the
 * auth callback, so it's never touched here (see the conditional spread
 * below — writing `username: d.username ?? null` would silently erase it).
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

  const enrolledCourses = formData.getAll('enrolledCourses').map(String).filter(Boolean);

  const diagnosticAnswers = ONBOARDING_DIAGNOSTIC_QUESTIONS.reduce<
    { questionId: string; answer: string }[]
  >((acc, { id }) => {
    const answer = str(formData.get(`diagnostic_${id}`));
    if (answer) acc.push({ questionId: id, answer });
    return acc;
  }, []);

  const parsed = onboardingSchema.safeParse({
    fullName: str(formData.get('fullName')),
    avatarUrl: str(formData.get('avatarUrl')),
    dateOfBirth: str(formData.get('dateOfBirth')),
    phoneNumber: str(formData.get('phoneNumber')),
    role: str(formData.get('role')),
    universityName: str(formData.get('universityName')),
    rollNumber: str(formData.get('rollNumber')),
    department: str(formData.get('department')),
    yearLevel: str(formData.get('yearLevel')),
    enrolledCourses: enrolledCourses.length ? enrolledCourses : undefined,
    diagnosticAnswers: diagnosticAnswers.length ? diagnosticAnswers : undefined,
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Some of those fields were invalid.' };
  }

  const d = parsed.data;

  if (!d.fullName) return { status: 'error', message: 'Full name is required.' };
  if (!d.universityName) {
    return { status: 'error', message: 'University / college name is required.' };
  }
  if (!d.rollNumber) {
    return { status: 'error', message: 'Registration / roll number is required.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: d.fullName,
      avatar_url: d.avatarUrl ?? null,
      date_of_birth: d.dateOfBirth ?? null,
      phone_number: d.phoneNumber ?? null,
      ...(d.role ? { role: d.role } : {}),
      university_name: d.universityName,
      roll_number: d.rollNumber,
      department: d.department ?? null,
      year_level: d.yearLevel ?? null,
      enrolled_courses: d.enrolledCourses ?? [],
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
