-- Priorbyte — lock signup to Karunya Institute of Technology and Sciences,
-- with role auto-derived from which domain the email is on.
--
-- Two independent layers, both real enforcement, not just a UI check:
--   1. before_user_created_hook (existing, from auth hardening) already
--      rejects any signup whose domain isn't in allowed_email_domains.
--      Populating that table with exactly these two domains means NO other
--      email can create an account at all, university or otherwise.
--   2. guard_profile_privileges now also enforces that a self-selected role
--      matches the account's own domain -- a @karunya.edu.in address can
--      never become 'faculty', and a @karunya.edu address can never become
--      'student', even if something bypasses the onboarding UI and calls
--      the API directly.

insert into public.allowed_email_domains (domain) values
  ('karunya.edu.in'),
  ('karunya.edu')
on conflict (domain) do nothing;

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

    -- Suffix match, not substring: '%@karunya.edu' does NOT match a
    -- '...@karunya.edu.in' address, since that string ends in '.in', not
    -- '.edu' -- the two domains can't be confused with each other here.
    if new.role = 'faculty' and new.email not like '%@karunya.edu' then
      raise exception 'faculty role requires a @karunya.edu email address';
    end if;
    if new.role = 'student' and new.email not like '%@karunya.edu.in' then
      raise exception 'student role requires a @karunya.edu.in email address';
    end if;
  end if;

  return new;
end;
$$;
