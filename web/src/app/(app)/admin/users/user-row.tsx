'use client';

import { useState, useTransition } from 'react';
import { SUBSCRIPTION_TIERS, USER_ROLES, type SubscriptionTier, type UserRole } from '@priorbyte/shared/constants';
import type { ProfileRow } from '@priorbyte/shared/database';
import { updateUserRole, updateUserTier } from './actions';

export function UserRow({ user, isSelf }: { user: ProfileRow; isSelf: boolean }) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [tier, setTier] = useState<SubscriptionTier>(user.subscription_tier);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  function handleRoleChange(next: UserRole) {
    const previous = role;
    setRole(next);
    setError(null);
    startTransition(async () => {
      const result = await updateUserRole(user.id, next);
      if (!result.ok) {
        setRole(previous);
        setError(result.message ?? 'Failed to update role.');
      }
    });
  }

  function handleTierChange(next: SubscriptionTier) {
    const previous = tier;
    setTier(next);
    setError(null);
    startTransition(async () => {
      const result = await updateUserTier(user.id, next);
      if (!result.ok) {
        setTier(previous);
        setError(result.message ?? 'Failed to update tier.');
      }
    });
  }

  return (
    <>
      <tr className="border-b border-line last:border-0">
        <td className="py-3 pr-4">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-left"
          >
            <p className="text-sm text-white underline decoration-dotted underline-offset-4">
              {user.display_name ?? user.username ?? user.email.split('@')[0]}
            </p>
            <p className="font-mono text-xs text-muted">{user.email}</p>
          </button>
          {error && <p className="mt-1 text-xs text-amber">{error}</p>}
        </td>
        <td className="py-3 pr-4">
          <select
            value={role}
            disabled={pending || isSelf}
            onChange={(e) => handleRoleChange(e.target.value as UserRole)}
            className="rounded-lg border border-line bg-background px-2 py-1.5 text-sm text-white outline-none focus:border-cyan/60 disabled:opacity-50"
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </td>
        <td className="py-3 pr-4">
          <select
            value={tier}
            disabled={pending}
            onChange={(e) => handleTierChange(e.target.value as SubscriptionTier)}
            className="rounded-lg border border-line bg-background px-2 py-1.5 text-sm text-white outline-none focus:border-cyan/60 disabled:opacity-50"
          >
            {SUBSCRIPTION_TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </td>
        <td className="py-3 pr-4 font-mono text-xs text-muted">
          {user.onboarding_completed_at ? 'Onboarded' : 'Incomplete'}
        </td>
        <td className="py-3 font-mono text-xs text-muted">
          {new Date(user.created_at).toLocaleDateString()}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-line last:border-0 bg-white/[0.02]">
          <td colSpan={5} className="py-4 pl-4 pr-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs sm:grid-cols-3">
              <Detail label="Username" value={user.username} />
              <Detail label="Date of birth" value={user.date_of_birth} />
              <Detail label="Phone number" value={user.phone_number} />
              <Detail label="Alternate email" value={user.alternate_email} />
              <Detail label="University" value={user.university_name} />
              <Detail label="Department" value={user.department} />
              <Detail label="Roll number" value={user.roll_number} />
              <Detail label="Year level" value={user.year_level} />
              <Detail label="Goal" value={user.goal} />
              <Detail
                label="Subjects"
                value={user.subjects.length > 0 ? user.subjects.join(', ') : null}
              />
              <Detail
                label="Enrolled courses"
                value={user.enrolled_courses.length > 0 ? String(user.enrolled_courses.length) : null}
              />
              <Detail label="Time zone" value={user.time_zone} />
              <Detail label="Language" value={user.language_preference} />
              <Detail label="Nickname" value={user.nickname} />
              <Detail label="User ID" value={user.id} mono />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="pb-label">{label}</p>
      <p className={`mt-0.5 text-white ${mono ? 'font-mono text-[11px] break-all' : ''}`}>
        {value ?? <span className="text-muted">—</span>}
      </p>
    </div>
  );
}
