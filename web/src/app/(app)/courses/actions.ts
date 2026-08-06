'use server';

import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export interface CourseActionResult {
  ok: boolean;
  message?: string;
}

export async function enrollInCourse(courseId: string): Promise<CourseActionResult> {
  const profile = await requireProfile();
  const supabase = createClient();

  const { error } = await supabase
    .from('course_enrollments')
    .insert({ course_id: courseId, user_id: profile.id });

  if (error) {
    if (error.code === '23505') return { ok: false, message: 'Already enrolled.' };
    return { ok: false, message: error.message };
  }

  revalidatePath('/courses');
  return { ok: true };
}

export async function leaveCourse(courseId: string): Promise<CourseActionResult> {
  const profile = await requireProfile();
  const supabase = createClient();

  const { error } = await supabase
    .from('course_enrollments')
    .delete()
    .eq('course_id', courseId)
    .eq('user_id', profile.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath('/courses');
  return { ok: true };
}
