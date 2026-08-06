-- Priorbyte — let any authenticated account browse the course catalogue.
--
-- "courses: members read" (20260801000300_courses.sql) only lets enrolled
-- students, staff, or admins see a course -- which works for a roster page
-- but makes self-enrollment impossible: a student can't join a course they
-- aren't allowed to see yet. Postgres RLS OR's multiple permissive select
-- policies together, so this adds visibility without touching the existing
-- policy or any other table's access.

create policy "courses: authenticated browse"
  on public.courses for select
  using (auth.uid() is not null);
