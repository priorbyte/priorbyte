import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldLogo } from '@/components/shield-logo';
import { SetupNotice } from '@/components/setup-notice';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams.next?.startsWith('/') ? searchParams.next : '/dashboard';

  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-blueprint bg-blueprint-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
      />

      <Link href="/" className="mb-8 flex flex-col items-center gap-3">
        <ShieldLogo className="h-12 w-12 text-cyan" />
        <span className="font-display text-xl font-bold text-white">Priorbyte</span>
      </Link>

      <div className="w-full max-w-sm">
        {isSupabaseConfigured() ? <LoginForm next={next} /> : <SetupNotice />}
      </div>
    </main>
  );
}
