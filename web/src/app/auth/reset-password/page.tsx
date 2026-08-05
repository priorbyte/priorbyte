import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldLogo } from '@/components/shield-logo';
import { ResetPasswordForm } from './form';

export const metadata: Metadata = { title: 'Reset password' };

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <Link href="/" className="flex flex-col items-center gap-3">
        <ShieldLogo className="h-12 w-12 text-cyan" />
        <span className="font-display text-xl font-bold text-white">Priorbyte</span>
      </Link>
      <div className="w-full max-w-sm">
        <ResetPasswordForm />
      </div>
      <Link href="/login" className="font-mono text-xs uppercase tracking-[0.2em] text-cyan">
        ← Back to sign in
      </Link>
    </main>
  );
}
