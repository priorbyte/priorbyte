'use client';

import { useState, useTransition } from 'react';
import type { CourseRow } from '@priorbyte/shared/database';
import { addStaffByEmail, removeStaff } from './actions';

interface StaffMember {
  userId: string;
  email: string;
}

export function CourseRow({ course, staff }: { course: CourseRow; staff: StaffMember[] }) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="pb-panel">
      <p className="pb-label">{course.code}</p>
      <h3 className="mt-1 text-xl text-white">{course.title}</h3>
      {course.institution && <p className="mt-1 text-sm text-muted">{course.institution}</p>}

      <div className="mt-4 border-t border-line pt-3">
        <p className="pb-label mb-2">Staff</p>
        <div className="flex flex-wrap gap-2">
          {staff.length === 0 && <p className="text-sm text-muted">No staff assigned yet.</p>}
          {staff.map((s) => (
            <button
              key={s.userId}
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await removeStaff(course.id, s.userId);
                  if (!result.ok) setError(result.message ?? 'Failed to remove.');
                })
              }
              className="rounded-full border border-cyan bg-cyan/10 px-3 py-1.5 text-sm text-cyan"
            >
              {s.email} ×
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="faculty@karunya.edu"
            className="flex-1 rounded-lg border border-line bg-background px-3 py-2 text-sm text-white outline-none focus:border-cyan/60"
          />
          <button
            type="button"
            disabled={!email.trim() || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await addStaffByEmail(course.id, email);
                if (result.ok) setEmail('');
                else setError(result.message ?? 'Failed to add.');
              })
            }
            className="rounded-lg border border-line px-4 py-2 text-sm text-silver transition hover:border-cyan/40 disabled:opacity-40"
          >
            Add staff
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-amber" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
