'use client';

import { useState, useTransition } from 'react';
import type { CourseRow } from '@priorbyte/shared/database';
import { enrollInCourse, leaveCourse } from './actions';

export function CourseCard({ course, enrolled }: { course: CourseRow; enrolled: boolean }) {
  const [isEnrolled, setIsEnrolled] = useState(enrolled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const next = !isEnrolled;
    setIsEnrolled(next);
    startTransition(async () => {
      const result = next ? await enrollInCourse(course.id) : await leaveCourse(course.id);
      if (!result.ok) {
        setIsEnrolled(!next);
        setError(result.message ?? 'Something went wrong.');
      }
    });
  }

  return (
    <div className="pb-panel flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="pb-label">{course.code}</p>
        <h3 className="mt-1 truncate text-lg text-white">{course.title}</h3>
        {course.institution && <p className="mt-1 text-sm text-muted">{course.institution}</p>}
        {error && (
          <p className="mt-1 text-xs text-amber" role="alert">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        className={`shrink-0 rounded-lg border px-4 py-2 text-sm transition disabled:opacity-50 ${
          isEnrolled
            ? 'border-amber/40 text-amber hover:bg-amber/10'
            : 'border-cyan/40 text-cyan hover:bg-cyan/10'
        }`}
      >
        {isEnrolled ? 'Leave' : 'Enroll'}
      </button>
    </div>
  );
}
