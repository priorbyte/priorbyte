'use server';

import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export interface FacultyActionResult {
  ok: boolean;
  message?: string;
}

/**
 * RLS ("courses: faculty create") is the actual gate here -- it only allows
 * the insert when the caller's role is faculty or admin. A student calling
 * this gets a Postgres permission error, not a client-side check.
 */
export async function createCourse(
  _prev: FacultyActionResult,
  formData: FormData,
): Promise<FacultyActionResult> {
  const profile = await requireProfile();

  const code = String(formData.get('code') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const institution = String(formData.get('institution') ?? '').trim();

  if (!code || !title) return { ok: false, message: 'Code and title are required.' };

  const supabase = createClient();
  const { error } = await supabase.from('courses').insert({
    code,
    title,
    institution: institution || null,
    created_by: profile.id,
  });

  if (error) {
    if (error.code === '23505') return { ok: false, message: 'That course code already exists.' };
    if (error.code === '42501') {
      return { ok: false, message: 'Only faculty accounts can create courses.' };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath('/faculty');
  return { ok: true };
}
