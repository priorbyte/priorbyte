import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Admin' };

const SECTIONS = [
  { href: '/admin/users', title: 'Users', description: 'Roles, tiers, and account status.' },
  {
    href: '/admin/knowledge-graph',
    title: 'Knowledge Graph',
    description: 'Topics, misconceptions, and prerequisites the Oracle predicts on.',
  },
  {
    href: '/admin/domains',
    title: 'Allowed Domains',
    description: 'Which email domains can sign up at all.',
  },
  {
    href: '/admin/courses',
    title: 'Courses & Staff',
    description: 'Create courses and assign faculty.',
  },
] as const;

export default async function AdminPage() {
  await requireAdmin();
  const supabase = createClient();

  const [{ count: userCount }, { count: topicCount }, { count: courseCount }, { count: domainCount }] =
    await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('knowledge_graph').select('id', { count: 'exact', head: true }),
      supabase.from('courses').select('id', { count: 'exact', head: true }),
      supabase.from('allowed_email_domains').select('domain', { count: 'exact', head: true }),
    ]);

  const stats = [
    { label: 'Users', value: userCount ?? 0 },
    { label: 'Topics', value: topicCount ?? 0 },
    { label: 'Courses', value: courseCount ?? 0 },
    { label: 'Allowed domains', value: domainCount ?? 0 },
  ];

  return (
    <div className="space-y-10">
      <div>
        <p className="pb-label">Admin</p>
        <h1 className="mt-2 text-4xl">Everything, one place</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="pb-panel">
            <p className="pb-label">{label}</p>
            <p className="mt-3 font-mono text-3xl text-cyan">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="pb-panel block transition hover:border-cyan/30">
            <h2 className="text-2xl">{s.title}</h2>
            <p className="mt-2 text-sm text-muted">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
