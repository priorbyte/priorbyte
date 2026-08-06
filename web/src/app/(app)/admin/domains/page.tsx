import type { Metadata } from 'next';
import type { AllowedEmailDomainRow } from '@priorbyte/shared/database';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DomainsList } from './domains-list';

export const metadata: Metadata = { title: 'Admin · Domains' };

export default async function AdminDomainsPage() {
  await requireAdmin();
  const supabase = createClient();

  const { data: domains } = await supabase
    .from('allowed_email_domains')
    .select('*')
    .order('domain')
    .returns<AllowedEmailDomainRow[]>();

  return (
    <div className="space-y-6">
      <div>
        <p className="pb-label">Admin</p>
        <h1 className="mt-2 text-4xl">Allowed Domains</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Only these domains can create an account. Removing the last one opens signup to
          everyone — there is no confirmation step, so double-check before removing.
        </p>
      </div>

      <DomainsList domains={domains ?? []} />
    </div>
  );
}
