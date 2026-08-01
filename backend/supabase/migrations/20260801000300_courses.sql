-- Priorbyte — courses, enrollment, and staffing.
--
-- Not named explicitly in Section 6, but chat_sharing_consent is defined as
-- *per-course*, so the privacy model cannot be enforced without a course
-- entity and a way to know who teaches it.

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  institution text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index courses_code_institution_idx
  on public.courses (lower(code), coalesce(lower(institution), ''));

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

-- Students in a course.
create table public.course_enrollments (
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

create index course_enrollments_user_idx on public.course_enrollments (user_id);

-- Faculty attached to a course.
create table public.course_staff (
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

create index course_staff_user_idx on public.course_staff (user_id);

-- The faculty member who creates a course is immediately staffed on it,
-- otherwise RLS would hide the course from its own author.
create or replace function public.staff_course_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.course_staff (course_id, user_id)
    values (new.id, new.created_by)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger courses_staff_creator
  after insert on public.courses
  for each row execute function public.staff_course_creator();

-- ---------------------------------------------------------------------------
-- Membership helpers. SECURITY DEFINER so policies on other tables can call
-- them without needing their own read access to these tables.
-- ---------------------------------------------------------------------------

create or replace function public.is_course_staff(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.course_staff cs
    where cs.course_id = target_course_id and cs.user_id = auth.uid()
  );
$$;

create or replace function public.is_enrolled_in(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.course_enrollments ce
    where ce.course_id = target_course_id and ce.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.courses enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.course_staff enable row level security;

create policy "courses: members read"
  on public.courses for select
  using (
    public.is_enrolled_in(id)
    or public.is_course_staff(id)
    or public.is_admin()
  );

create policy "courses: faculty create"
  on public.courses for insert
  with check (public.current_role_is('faculty') or public.is_admin());

create policy "courses: staff update"
  on public.courses for update
  using (public.is_course_staff(id) or public.is_admin())
  with check (public.is_course_staff(id) or public.is_admin());

create policy "enrollments: student reads own"
  on public.course_enrollments for select
  using (auth.uid() = user_id);

create policy "enrollments: staff read course roster"
  on public.course_enrollments for select
  using (public.is_course_staff(course_id) or public.is_admin());

create policy "enrollments: student joins self"
  on public.course_enrollments for insert
  with check (auth.uid() = user_id);

create policy "enrollments: student leaves self"
  on public.course_enrollments for delete
  using (auth.uid() = user_id);

create policy "staff: read own assignments"
  on public.course_staff for select
  using (auth.uid() = user_id);

create policy "staff: read co-staff"
  on public.course_staff for select
  using (public.is_course_staff(course_id) or public.is_admin());

create policy "staff: admin manages"
  on public.course_staff for all
  using (public.is_admin())
  with check (public.is_admin());
