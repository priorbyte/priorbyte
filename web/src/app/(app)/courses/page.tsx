import type { Metadata } from 'next';
import type { CourseRow } from '@priorbyte/shared/database';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CourseCard } from './course-card';

export const metadata: Metadata = { title: 'Courses' };

export default async function CoursesPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const [{ data: courses }, { data: enrollments }] = await Promise.all([
    supabase.from('courses').select('*').order('code').returns<CourseRow[]>(),
    supabase.from('course_enrollments').select('course_id').eq('user_id', profile.id),
  ]);

  const enrolledIds = new Set((enrollments ?? []).map((e) => e.course_id));

  return (
    <div className="space-y-6">
      <div>
        <p className="pb-label">Courses</p>
        <h1 className="mt-2 text-4xl">Browse & enroll.</h1>
        <p className="mt-2 max-w-2xl text-silver">
          Enrolling lets course staff see your progress in that course and lets you opt into
          sharing chats with them from Settings — nothing is shared until you choose to.
        </p>
      </div>

      {(courses ?? []).length === 0 ? (
        <p className="text-sm text-muted">No courses have been created yet.</p>
      ) : (
        <div className="space-y-3">
          {(courses ?? []).map((course) => (
            <CourseCard key={course.id} course={course} enrolled={enrolledIds.has(course.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
