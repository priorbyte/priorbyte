-- Priorbyte — auth hardening: signup domain allowlist + magic-link rate limiting.
--
-- Two independent defenses:
--   1. A domain allowlist enforced by a Supabase "Before User Created" Auth
--      Hook, so a rejected signup never creates an auth.users row at all.
--      Empty allowlist = allow every domain (safe default; nobody is locked
--      out until an admin opts in by adding rows).
--   2. Per-email rate limiting on magic-link requests, enforced server-side
--      via RPC, independent of (and in addition to) Supabase's own built-in
--      Auth rate limits.
--
-- Wiring the hook itself is a dashboard step (Auth Hooks are not SQL-
-- configurable) — see backend/README.md.

-- ---------------------------------------------------------------------------
-- Domain allowlist
-- ---------------------------------------------------------------------------

create table public.allowed_email_domains (
  domain text primary key,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.allowed_email_domains enable row level security;

create policy "allowed_email_domains: admin manages"
  on public.allowed_email_domains for all
  using (public.is_admin())
  with check (public.is_admin());

-- Deliberately no anon/authenticated read policy: the hook function below
-- reads this table as SECURITY DEFINER, owned by the migration role, which
-- bypasses RLS as the table owner. Nothing else needs to see the list.

create or replace function public.is_email_domain_allowed(candidate_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Empty allowlist means unrestricted signup.
    not exists (select 1 from public.allowed_email_domains)
    or exists (
      select 1 from public.allowed_email_domains d
      where lower(split_part(candidate_email, '@', 2)) = d.domain
    );
$$;

-- ---------------------------------------------------------------------------
-- Supabase "Before User Created" Auth Hook contract: receives
-- { "user": { "email": ..., ... }, ... } and must return the SAME shape to
-- allow the signup through. Raising an exception aborts user creation and
-- the message surfaces to the client as the signInWithOtp() error.
-- ---------------------------------------------------------------------------

create or replace function public.before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_email text := event -> 'user' ->> 'email';
begin
  if candidate_email is null then
    raise exception 'Signup rejected: no email on the incoming user.';
  end if;

  if not public.is_email_domain_allowed(candidate_email) then
    raise exception 'Signups are restricted to approved email domains.';
  end if;

  return event;
end;
$$;

-- The Auth service calls these as the `supabase_auth_admin` role. Postgres
-- grants EXECUTE to PUBLIC on every new function by default, so without the
-- explicit revokes below both functions would also be callable directly by
-- any signed-in user via RPC — not a privilege-escalation path (each checks
-- auth.uid() or has no side effects), but there is no legitimate reason for
-- a client to call either one, and Supabase's own Auth Hooks setup flags
-- exactly this.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;
grant execute on function public.is_email_domain_allowed(text) to supabase_auth_admin;
revoke execute on function public.before_user_created_hook(jsonb) from authenticated, anon, public;
revoke execute on function public.is_email_domain_allowed(text) from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- Magic-link rate limiting
-- ---------------------------------------------------------------------------

create table public.magic_link_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  requested_at timestamptz not null default now()
);

create index magic_link_attempts_email_time_idx
  on public.magic_link_attempts (lower(email), requested_at desc);

-- Unindexed growth from a log table is a real cost; prune anything an hour
-- old whenever a new attempt is recorded, so the table self-limits its size.
alter table public.magic_link_attempts enable row level security;
-- No policies at all: only the SECURITY DEFINER function below touches this
-- table. Direct REST access is denied to every role, including authenticated.

create or replace function public.request_magic_link_allowed(
  target_email text,
  max_attempts int default 5,
  window_minutes int default 15
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
begin
  if target_email is null or target_email = '' then
    return false;
  end if;

  delete from public.magic_link_attempts
  where requested_at < now() - interval '1 hour';

  select count(*) into recent_count
  from public.magic_link_attempts
  where lower(email) = lower(target_email)
    and requested_at > now() - (window_minutes || ' minutes')::interval;

  if recent_count >= max_attempts then
    return false;
  end if;

  insert into public.magic_link_attempts (email) values (lower(target_email));
  return true;
end;
$$;

-- Callable pre-auth, by design: this is what gates the sign-in request
-- itself, so it must work for a caller who is not signed in yet.
grant execute on function public.request_magic_link_allowed(text, int, int) to anon, authenticated;
