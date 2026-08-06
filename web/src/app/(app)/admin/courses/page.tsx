import type { Metadata } from 'next';
import type { CourseRow } from '@priorbyte/shared/database';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CreateCourseForm } from './create-course-form';
import { CourseRow as CourseRowView } from './course-row';

export const metadata: Metadata = { title: 'Admin · Courses' };

export default async function AdminCoursesPage() {
  await requireAdmin();
  const supabase = createClient();

  const [{ data: courses }, { data: staffRows }] = await Promise.all([
    supabase.from('courses').select('*').order('code').returns<CourseRow[]>(),
    supabase.from('course_staff').select('course_id, user_id'),
  ]);

  const staffUserIds = [...new Set((staffRows ?? []).map((s) => s.user_id))];
  const { data: staffProfiles } =
    staffUserIds.length > 0
      ? await supabase.from('profiles').select('id, email').in('id', staffUserIds)
      : { data: [] };

  const emailById = new Map((staffProfiles ?? []).map((p) => [p.id, p.email]));
  const staffByCourseId = new Map<string, { userId: string; email: string }[]>();
  for (const row of staffRows ?? []) {
    const list = staffByCourseId.get(row.course_id) ?? [];
    list.push({ userId: row.user_id, email: emailById.get(row.user_id) ?? 'unknown' });
    staffByCourseId.set(row.course_id, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="pb-label">Admin</p>
        <h1 className="mt-2 text-4xl">Courses & Staff</h1>
      </div>

      <CreateCourseForm />

      <div className="space-y-4">
        {(courses ?? []).map((course) => (
          <CourseRowView
            key={course.id}
            course={course}
            staff={staffByCourseId.get(course.id) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
