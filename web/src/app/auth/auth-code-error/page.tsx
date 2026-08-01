import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldLogo } from '@/components/shield-logo';

export const metadata: Metadata = { title: 'Link expired' };

export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <ShieldLogo className="h-12 w-12 text-amber" />
      <h1 className="text-3xl">That link didn&apos;t work</h1>
      <p className="max-w-md text-silver">
        Magic links are single-use and expire after an hour. Request a fresh one and it will work.
      </p>
      <Link
        href="/login"
        className="rounded-lg bg-cyan px-6 py-3 font-display font-bold text-background transition hover:shadow-glow"
      >
        Send a new link
      </Link>
    </main>
  );
}
