-- Priorbyte — let course staff resolve student identities on their own roster.
--
-- The consent model (20260801000900_chat_and_consent.sql) already lets staff
-- read shared conversations and chat_history rows for consenting students,
-- via can_read_shared_chat(). But those rows only carry user_id -- staff had
-- no way to turn that into a name or email, since profiles has no policy
-- covering anyone but the row's own owner and admins. This adds exactly one
-- narrow read path: a student's profile is visible to staff of a course that
-- student is actually enrolled in. Nothing else about profiles changes.

create policy "profiles: course staff read enrolled students"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.course_enrollments ce
      where ce.user_id = profiles.id
        and public.is_course_staff(ce.course_id)
    )
  );
