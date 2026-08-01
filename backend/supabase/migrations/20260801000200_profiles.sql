-- Priorbyte — user profiles, linked 1:1 to auth.users.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  role public.user_role not null default 'student',
  subscription_tier public.subscription_tier not null default 'free',
  -- Free-text goal from the onboarding wizard. Skippable, hence nullable.
  goal text,
  subjects text[] not null default '{}',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-provision a profile on signup. SECURITY DEFINER because the inserting
-- role during signup is not the new user.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helpers used by policies across the schema. SECURITY DEFINER so they can
-- read profiles without recursing through profiles' own RLS.
-- ---------------------------------------------------------------------------

create or replace function public.current_role_is(target public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = target
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_role_is('admin');
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "profiles: owner reads own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: owner updates own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Insert is normally done by the signup trigger; this covers repair cases.
create policy "profiles: owner inserts own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: admin reads all"
  on public.profiles for select
  using (public.is_admin());

-- No delete policy: profiles are removed only by cascading auth.users deletion.

-- ---------------------------------------------------------------------------
-- Role and tier are NOT self-serviceable. A student must not be able to
-- promote themselves to faculty or to the pro tier by updating their own row.
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role and admins bypass the guard; everyone else is frozen out.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'role cannot be changed by the account owner';
  end if;

  if new.subscription_tier is distinct from old.subscription_tier then
    raise exception 'subscription_tier is set by billing, not by the account owner';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();
