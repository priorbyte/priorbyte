'use server';

import { revalidatePath } from 'next/cache';
import { onboardingSchema } from '@priorbyte/shared/schemas';
import { createClient } from '@/lib/supabase/server';

export interface ProfileFormState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
}

function str(value: FormDataEntryValue | null): string | undefined {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Everything from onboarding except `role` (locked forever after the first
 * onboarding completes — see guard_profile_privileges) and the diagnostic
 * (a one-time capture, not an editable field).
 */
export async function updateProfileDetails(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Not signed in.' };

  const subjects = formData.getAll('subjects').map(String).filter(Boolean);
  const enrolledCourses = formData.getAll('enrolledCourses').map(String).filter(Boolean);

  const parsed = onboardingSchema.safeParse({
    goal: str(formData.get('goal')),
    fullName: str(formData.get('fullName')),
    username: str(formData.get('username')),
    avatarUrl: str(formData.get('avatarUrl')),
    dateOfBirth: str(formData.get('dateOfBirth')),
    phoneNumber: str(formData.get('phoneNumber')),
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
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Some of those fields were invalid.' };
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
      university_name: d.universityName ?? null,
      roll_number: d.rollNumber ?? null,
      department: d.department ?? null,
      year_level: d.yearLevel ?? null,
      enrolled_courses: d.enrolledCourses ?? [],
      subjects: d.subjects ?? [],
      alternate_email: d.alternateEmail ?? null,
      time_zone: d.timeZone ?? 'UTC',
      language_preference: d.languagePreference ?? 'en',
      ...(d.notificationPreferences ? { notification_preferences: d.notificationPreferences } : {}),
    })
    .eq('id', user.id);

  if (error) {
    if (error.code === '23505') {
      return { status: 'error', message: 'That username is already taken.' };
    }
    return { status: 'error', message: error.message };
  }

  revalidatePath('/dashboard');
  revalidatePath('/settings');
  return { status: 'saved' };
}
