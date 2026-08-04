'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface CaptureState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
}

/**
 * Manual capture for testing Ghost Memory without the extension loaded.
 * Same table, same RLS, same embedding backfill path as a real extension
 * capture — this just gives it a source label distinct from the extension's.
 */
export async function captureTestNote(
  _prev: CaptureState,
  formData: FormData,
): Promise<CaptureState> {
  const content = String(formData.get('content') ?? '').trim();
  if (!content) return { status: 'error', message: 'Write something first.' };
  if (content.length > 20_000) return { status: 'error', message: 'Too long.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Not signed in.' };

  const { error } = await supabase.from('learning_events').insert({
    user_id: user.id,
    type: 'note',
    content,
    source: 'manual_web',
  });

  if (error) return { status: 'error', message: error.message };

  revalidatePath('/memory');
  revalidatePath('/dashboard');
  return { status: 'saved' };
}
