-- Priorbyte — expanded student profile: identity, academic, and preference
-- fields collected during onboarding, plus avatar upload storage.

create type public.year_level as enum (
  'freshman', 'sophomore', 'junior', 'senior', 'graduate', 'other'
);

alter table public.profiles
  add column username text,
  add column date_of_birth date,
  add column phone_number text,
  add column university_name text,
  add column roll_number text,
  add column department text,
  add column year_level public.year_level,
  -- Free-text course tags, distinct from the formal courses/course_enrollments
  -- relation: there is no course-discovery flow yet for students to join a
  -- real course record, so this is self-reported until that exists.
  add column enrolled_courses text[] not null default '{}',
  add column alternate_email text,
  add column time_zone text not null default 'UTC',
  add column language_preference text not null default 'en',
  add column notification_preferences jsonb not null default
    '{"email": true, "productUpdates": true, "weeklyDigest": true}'::jsonb;

-- Username: unique, format-checked, case-insensitive.
create unique index profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

alter table public.profiles
  add constraint profiles_username_format check (
    username is null or username ~ '^[a-zA-Z0-9_]{3,30}$'
  );

-- Availability check callable pre-save (e.g. on blur in the onboarding form),
-- without granting read access to the rest of anyone else's profile.
create or replace function public.is_username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    candidate ~ '^[a-zA-Z0-9_]{3,30}$'
    and not exists (
      select 1 from public.profiles p where lower(p.username) = lower(candidate)
    );
$$;

grant execute on function public.is_username_available(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Role becomes self-service, but only ONCE: a student may declare
-- student/faculty the first time they complete onboarding, then it freezes.
-- `admin` can never be self-selected, at any time, by anyone but another admin.
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role and admins bypass the guard entirely.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.subscription_tier is distinct from old.subscription_tier then
    raise exception 'subscription_tier is set by billing, not by the account owner';
  end if;

  if new.role is distinct from old.role then
    if old.onboarding_completed_at is not null then
      raise exception 'role can only be set during initial onboarding';
    end if;
    if new.role not in ('student', 'faculty') then
      raise exception 'role must be student or faculty when self-selected';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Avatar storage: a public-read bucket, but a student may only write inside
-- their own folder (path convention: avatars/<user_id>/<filename>).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: owner uploads own folder"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatars: owner updates own folder"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatars: owner deletes own folder"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
