-- Priorbyte — AI usage metering.
--
-- Enforces the Section 10 tier limits (free = 10 AI queries/month). Counted
-- server-side; the client is never trusted with its own quota.

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 'tutor' | 'summarize' | 'flashcards' | 'quiz' | 'mindmap' | …
  feature text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  model text,
  created_at timestamptz not null default now()
);

create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

-- Read-only to the owner so the UI can show "3 of 10 used this month".
create policy "ai_usage: owner reads own"
  on public.ai_usage for select
  using (auth.uid() = user_id);

-- Inserts happen server-side under the service-role key. No owner insert
-- policy: a client that could write its own usage rows could also not write
-- them.

-- ---------------------------------------------------------------------------
-- Quota check. Returns remaining queries for the current calendar month,
-- or null when the caller's tier is unlimited.
-- ---------------------------------------------------------------------------

create or replace function public.ai_queries_remaining(target_user_id uuid default null)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := coalesce(target_user_id, auth.uid());
  tier public.subscription_tier;
  used int;
  monthly_limit int;
begin
  if uid is null then
    raise exception 'ai_queries_remaining requires a user';
  end if;

  -- Callers may only ask about themselves unless they are the service role.
  if auth.uid() is not null and uid <> auth.uid() then
    raise exception 'cannot read another user''s quota';
  end if;

  select p.subscription_tier into tier from public.profiles p where p.id = uid;

  monthly_limit := case tier
    when 'free' then 10
    else null  -- pro / teams / enterprise are unlimited
  end;

  if monthly_limit is null then
    return null;
  end if;

  select count(*)::int into used
  from public.ai_usage u
  where u.user_id = uid
    and u.created_at >= date_trunc('month', now());

  return greatest(monthly_limit - used, 0);
end;
$$;
