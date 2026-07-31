import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldLogo } from '@/components/shield-logo';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Placeholder. The real magic-link flow lands in step 3 (Supabase Auth);
 * this exists so the landing page CTA resolves.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <ShieldLogo className="h-12 w-12 text-cyan" />
      <h1 className="text-3xl">Magic-link sign-in</h1>
      <p className="max-w-md text-silver">
        Coming in step 3 — Supabase Auth, email only, no passwords.
      </p>
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-cyan">
        ← Back
      </Link>
    </main>
  );
}
