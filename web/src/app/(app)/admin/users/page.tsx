import type { Metadata } from 'next';
import type { ProfileRow } from '@priorbyte/shared/database';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { UserRow } from './user-row';

export const metadata: Metadata = { title: 'Admin · Users' };

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const supabase = createClient();

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<ProfileRow[]>();

  return (
    <div className="space-y-6">
      <div>
        <p className="pb-label">Admin</p>
        <h1 className="mt-2 text-4xl">Users</h1>
        <p className="mt-2 text-sm text-muted">{users?.length ?? 0} accounts total.</p>
      </div>

      <div className="pb-panel overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <th className="pb-2 pr-4 font-normal">User</th>
              <th className="pb-2 pr-4 font-normal">Role</th>
              <th className="pb-2 pr-4 font-normal">Tier</th>
              <th className="pb-2 pr-4 font-normal">Onboarding</th>
              <th className="pb-2 font-normal">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((user) => (
              <UserRow key={user.id} user={user} isSelf={user.id === admin.id} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
