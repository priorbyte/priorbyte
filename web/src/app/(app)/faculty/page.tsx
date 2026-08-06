import Link from 'next/link';
import type { Metadata } from 'next';
import type { CourseRow } from '@priorbyte/shared/database';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CreateCourseForm } from './create-course-form';

export const metadata: Metadata = { title: 'Faculty' };

export default async function FacultyPage() {
  await requireProfile();
  const supabase = createClient();

  const { data: staffRows } = await supabase.from('course_staff').select('course_id');
  const courseIds = (staffRows ?? []).map((r) => r.course_id);

  const { data: courses } =
    courseIds.length > 0
      ? await supabase
          .from('courses')
          .select('*')
          .in('id', courseIds)
          .order('code')
          .returns<CourseRow[]>()
      : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <p className="pb-label">Faculty</p>
        <h1 className="mt-2 text-4xl">Your courses.</h1>
        <p className="mt-2 max-w-2xl text-silver">
          Chats only appear here for students who explicitly opted to share them, per course.
          It&apos;s revocable by them at any time and there&apos;s no way to see anything they
          haven&apos;t shared.
        </p>
      </div>

      <CreateCourseForm />

      {(courses ?? []).length === 0 ? (
        <p className="text-sm text-muted">
          You aren&apos;t staffed on any course yet — an admin adds staff from the admin portal.
        </p>
      ) : (
        <div className="space-y-3">
          {(courses ?? []).map((course) => (
            <Link
              key={course.id}
              href={`/faculty/${course.id}`}
              className="pb-panel block transition hover:border-cyan/30"
            >
              <p className="pb-label">{course.code}</p>
              <h2 className="mt-1 text-xl text-white">{course.title}</h2>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
