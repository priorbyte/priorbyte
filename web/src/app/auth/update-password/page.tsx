import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ShieldLogo } from '@/components/shield-logo';
import { createClient } from '@/lib/supabase/server';
import { UpdatePasswordForm } from './form';

export const metadata: Metadata = { title: 'Set a new password' };
export const dynamic = 'force-dynamic';

export default async function UpdatePasswordPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session means the recovery link was never clicked (or already used) —
  // send them to request a fresh one instead of showing a form that will
  // just fail on submit.
  if (!user) redirect('/auth/reset-password');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <ShieldLogo className="h-12 w-12 text-cyan" />
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-center text-2xl text-white">Set a new password</h1>
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
