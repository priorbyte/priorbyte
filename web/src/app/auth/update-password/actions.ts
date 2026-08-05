'use server';

import { redirect } from 'next/navigation';
import { updatePasswordSchema } from '@priorbyte/shared/schemas';
import { createClient } from '@/lib/supabase/server';

export interface UpdatePasswordState {
  status: 'idle' | 'error';
  message?: string;
}

/**
 * Requires an active session — the recovery link's code exchange (in
 * /auth/callback) already established one before landing here. Works
 * equally for "I forgot my password" and "my account predates password
 * auth and has never had one."
 */
export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const parsed = updatePasswordSchema.safeParse({ password: formData.get('password') });
  if (!parsed.success) {
    return { status: 'error', message: 'Password must be at least 8 characters.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      status: 'error',
      message: 'That reset link has expired. Request a new one from the sign-in page.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { status: 'error', message: error.message };
  }

  redirect('/dashboard');
}
