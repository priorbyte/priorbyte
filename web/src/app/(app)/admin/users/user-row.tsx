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
    <tr className="border-b border-line last:border-0">
      <td className="py-3 pr-4">
        <p className="text-sm text-white">
          {user.display_name ?? user.username ?? user.email.split('@')[0]}
        </p>
        <p className="font-mono text-xs text-muted">{user.email}</p>
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
  );
}
