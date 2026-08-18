'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SubscriptionTier, UserRole } from '@priorbyte/shared/constants';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/tutor', label: 'AI Tutor', icon: 'memory' },
  { href: '/tools', label: 'Learning Tools', icon: 'build' },
  { href: '/courses', label: 'Courses', icon: 'school' },
] as const;

const GHOST_LINKS = [
  { href: '/timeline', label: 'Ghost Timeline', icon: 'linear_scale' },
  { href: '/ghost-score', label: 'Ghost Score', icon: 'data_object' },
  { href: '/memory', label: 'Ghost Memory', icon: 'save' },
  { href: '/oracle', label: 'Ghost Oracle', icon: 'bug_report' },
] as const;

const SETTINGS_LINK = { href: '/settings', label: 'Settings', icon: 'settings' } as const;

function NavIcon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
      {name}
    </span>
  );
}

function SidebarLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded p-2 font-label text-xs uppercase tracking-wider transition-all duration-200 ease-in-out ${
        active
          ? 'bg-cyan/10 text-cyan'
          : 'text-muted hover:bg-surface-raised hover:text-silver'
      }`}
    >
      <NavIcon name={icon} />
      {label}
    </Link>
  );
}

export function AppNav({
  displayName,
  tier,
  role,
  signOutAction,
  children,
}: {
  displayName: string;
  tier: SubscriptionTier;
  role: UserRole;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const roleLink =
    role === 'faculty'
      ? { href: '/faculty', label: 'Faculty', icon: 'badge' }
      : role === 'admin'
        ? { href: '/admin', label: 'Admin', icon: 'admin_panel_settings' }
        : null;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-16 w-full shrink-0 items-center justify-between border-b border-line bg-surface px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="material-symbols-outlined text-cyan" aria-hidden="true">
            terminal
          </span>
          <span className="font-display text-lg uppercase tracking-wide text-cyan">Priorbyte</span>
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded border border-cyan px-3 py-1.5 font-label text-xs uppercase tracking-wider text-cyan transition-colors hover:bg-cyan hover:text-background"
          >
            Sign out
          </button>
        </form>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-background p-4 md:flex">
          <div className="mb-6 flex items-center gap-2 rounded border border-line p-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-raised">
              <span className="material-symbols-outlined text-cyan" aria-hidden="true">
                account_circle
              </span>
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-label text-xs uppercase tracking-wider text-white">
                {displayName}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-widest text-muted">{tier}</span>
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse-eye rounded-full bg-cyan" />
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-1" aria-label="Main">
            {LINKS.map((link) => (
              <SidebarLink key={link.href} {...link} active={isActive(link.href)} />
            ))}

            <div className="my-2 border-t border-line" />

            {GHOST_LINKS.map((link) => (
              <SidebarLink key={link.href} {...link} active={isActive(link.href)} />
            ))}

            <div className="my-2 border-t border-line" />

            <SidebarLink {...SETTINGS_LINK} active={isActive(SETTINGS_LINK.href)} />
            {roleLink && <SidebarLink {...roleLink} active={isActive(roleLink.href)} />}
          </nav>
        </aside>

        {/* Mobile nav — the sidebar collapses below md, so give small screens a
            horizontal scroller instead of losing navigation entirely. */}
        <nav
          className="flex w-full gap-1 overflow-x-auto border-b border-line bg-background p-2 md:hidden"
          aria-label="Main"
        >
          {[...LINKS, ...GHOST_LINKS, SETTINGS_LINK, ...(roleLink ? [roleLink] : [])].map(
            (link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded px-3 py-2 font-label text-xs uppercase tracking-wider ${
                  isActive(link.href) ? 'bg-cyan/10 text-cyan' : 'text-muted'
                }`}
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto bg-background p-4 md:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
