'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export interface AdminActionResult {
  ok: boolean;
  message?: string;
}

export async function createCourse(
  _prev: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();

  const code = String(formData.get('code') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const institution = String(formData.get('institution') ?? '').trim();

  if (!code || !title) return { ok: false, message: 'Code and title are required.' };

  const supabase = createClient();
  const { error } = await supabase.from('courses').insert({
    code,
    title,
    institution: institution || null,
    created_by: admin.id,
  });

  if (error) {
    if (error.code === '23505') return { ok: false, message: 'That course code already exists.' };
    return { ok: false, message: error.message };
  }

  revalidatePath('/admin/courses');
  return { ok: true };
}

/**
 * Staff are looked up by email rather than picked from a dropdown — the
 * admin portal has no reason to load every profile just to staff one
 * course, and email is what an admin actually has on hand for a faculty
 * member.
 */
export async function addStaffByEmail(
  courseId: string,
  email: string,
): Promise<AdminActionResult> {
  await requireAdmin();
  const supabase = createClient();

  const { data: user, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (lookupError) return { ok: false, message: lookupError.message };
  if (!user) return { ok: false, message: 'No account with that email.' };

  const { error } = await supabase
    .from('course_staff')
    .insert({ course_id: courseId, user_id: user.id });

  if (error) {
    if (error.code === '23505') return { ok: false, message: 'Already staffed on this course.' };
    return { ok: false, message: error.message };
  }

  revalidatePath('/admin/courses');
  return { ok: true };
}

export async function removeStaff(courseId: string, userId: string): Promise<AdminActionResult> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase
    .from('course_staff')
    .delete()
    .eq('course_id', courseId)
    .eq('user_id', userId);
  if (error) return { ok: false, message: error.message };

  revalidatePath('/admin/courses');
  return { ok: true };
}
