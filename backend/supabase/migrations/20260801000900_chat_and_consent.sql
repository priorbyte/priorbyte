-- Priorbyte — chat history and the privacy model (Section 7).
--
-- HARD CONSTRAINT: staff have no raw chat access by default. Access exists
-- only where the student has explicitly opted in, per course, and it is
-- revocable at any time. Enforcement lives here in Postgres, not in app code,
-- so a bug in /web cannot leak a conversation.

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  course_id uuid references public.courses (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_conversations_user_idx
  on public.chat_conversations (user_id, updated_at desc);

create trigger chat_conversations_set_updated_at
  before update on public.chat_conversations
  for each row execute function public.set_updated_at();

create table public.chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  role public.chat_role not null,
  content text not null,
  -- Denormalised from the conversation so the RLS policy can consent-check a
  -- single row without a join it might not be allowed to perform.
  course_id uuid references public.courses (id) on delete set null,
  -- Ghost Memory rows fed to Claude as context for this turn; for audit.
  context_event_ids uuid[] not null default '{}',
  token_count int,
  created_at timestamptz not null default now()
);

create index chat_history_conversation_idx
  on public.chat_history (conversation_id, created_at);

create index chat_history_user_idx on public.chat_history (user_id, created_at desc);

-- Keep the denormalised course_id truthful.
create or replace function public.sync_chat_course_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select c.course_id into new.course_id
  from public.chat_conversations c
  where c.id = new.conversation_id;
  return new;
end;
$$;

create trigger chat_history_sync_course
  before insert on public.chat_history
  for each row execute function public.sync_chat_course_id();

-- ---------------------------------------------------------------------------
-- chat_sharing_consent — per course, per student. No row means `none`.
-- ---------------------------------------------------------------------------

create table public.chat_sharing_consent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  level public.chat_sharing_level not null default 'none',
  -- Only meaningful when level = 'selected'.
  shared_conversation_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (user_id, course_id),

  -- array_length returns NULL for an empty array, and a CHECK that evaluates
  -- to NULL passes — hence the coalesce, without which level='selected' with
  -- an empty list would slip through and share nothing while looking shared.
  constraint selected_requires_conversations check (
    level <> 'selected' or coalesce(array_length(shared_conversation_ids, 1), 0) > 0
  )
);

create trigger chat_sharing_consent_set_updated_at
  before update on public.chat_sharing_consent
  for each row execute function public.set_updated_at();

-- Audit trail. Consent changes are security-relevant, so they are recorded
-- append-only and the student can review their own history.
create table public.chat_sharing_consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  previous_level public.chat_sharing_level,
  new_level public.chat_sharing_level not null,
  changed_at timestamptz not null default now()
);

create index chat_sharing_consent_log_user_idx
  on public.chat_sharing_consent_log (user_id, changed_at desc);

create or replace function public.log_consent_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_sharing_consent_log (user_id, course_id, previous_level, new_level)
  values (
    new.user_id,
    new.course_id,
    case when tg_op = 'UPDATE' then old.level else null end,
    new.level
  );
  return new;
end;
$$;

create trigger chat_sharing_consent_log_changes
  after insert or update of level on public.chat_sharing_consent
  for each row execute function public.log_consent_change();

-- ---------------------------------------------------------------------------
-- The consent gate. This one function is the whole privacy model.
--
-- Returns true only when the student named by `owner_id` has actively opted
-- in for `target_course_id` at a level that covers `target_conversation_id`,
-- AND the caller is staff on exactly that course.
-- ---------------------------------------------------------------------------

create or replace function public.can_read_shared_chat(
  owner_id uuid,
  target_course_id uuid,
  target_conversation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- A student's own chat is never "shared"; that path is a separate policy.
    owner_id <> auth.uid()
    -- Un-coursed conversations can never be shared. No course, no consent.
    and target_course_id is not null
    and public.is_course_staff(target_course_id)
    and exists (
      select 1
      from public.chat_sharing_consent c
      where c.user_id = owner_id
        and c.course_id = target_course_id
        and (
          c.level = 'full'
          or (c.level = 'selected' and target_conversation_id = any (c.shared_conversation_ids))
        )
    );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.chat_conversations enable row level security;
alter table public.chat_history enable row level security;
alter table public.chat_sharing_consent enable row level security;
alter table public.chat_sharing_consent_log enable row level security;

create policy "chat_conversations: owner all"
  on public.chat_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "chat_conversations: consented staff read"
  on public.chat_conversations for select
  using (public.can_read_shared_chat(user_id, course_id, id));

create policy "chat_history: owner reads own"
  on public.chat_history for select
  using (auth.uid() = user_id);

create policy "chat_history: owner inserts own"
  on public.chat_history for insert
  with check (auth.uid() = user_id);

create policy "chat_history: owner deletes own"
  on public.chat_history for delete
  using (auth.uid() = user_id);

-- The only non-owner read path into chat content that exists anywhere.
create policy "chat_history: consented staff read"
  on public.chat_history for select
  using (public.can_read_shared_chat(user_id, course_id, conversation_id));

-- No update policy on chat_history at all: a transcript is immutable.

create policy "chat_sharing_consent: owner all"
  on public.chat_sharing_consent for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Staff may see WHETHER a student shared, never infer it from failed reads.
create policy "chat_sharing_consent: staff read level"
  on public.chat_sharing_consent for select
  using (public.is_course_staff(course_id));

create policy "chat_sharing_consent_log: owner reads own"
  on public.chat_sharing_consent_log for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- No bulk export for staff, ever. Revoke the blanket grants so a future
-- migration cannot accidentally hand staff a table-wide scan.
-- ---------------------------------------------------------------------------

revoke all on public.chat_history from anon;
revoke all on public.chat_conversations from anon;
revoke all on public.chat_sharing_consent from anon;
