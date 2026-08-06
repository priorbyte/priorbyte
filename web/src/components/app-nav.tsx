'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SubscriptionTier, UserRole } from '@priorbyte/shared/constants';
import { ShieldLogo } from '@/components/shield-logo';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tutor', label: 'AI Tutor' },
  { href: '/tools', label: 'Learning Tools' },
  { href: '/courses', label: 'Courses' },
  { href: '/timeline', label: 'Ghost Timeline' },
  { href: '/ghost-score', label: 'Ghost Score' },
  { href: '/memory', label: 'Ghost Memory' },
  { href: '/oracle', label: 'Ghost Oracle' },
  { href: '/settings', label: 'Settings' },
] as const;

export function AppNav({
  displayName,
  tier,
  role,
  signOutAction,
}: {
  displayName: string;
  tier: SubscriptionTier;
  role: UserRole;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const links = role === 'admin' ? [...LINKS, { href: '/admin', label: 'Admin' }] : LINKS;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <ShieldLogo className="h-7 w-7 text-cyan" />
          <span className="font-display font-bold text-white">Priorbyte</span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Main">
          {links.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active ? 'bg-cyan/10 text-cyan' : 'text-silver hover:text-white'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <span className="hidden font-mono text-xs uppercase tracking-[0.2em] text-muted sm:inline">
            {displayName} · {tier}
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg border border-line px-3 py-2 text-sm text-silver transition hover:border-amber/50 hover:text-amber"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
