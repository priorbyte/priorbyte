-- Priorbyte — Ghost Timeline.
--
-- `topic_mastery` is the current position of a student on one topic
-- (Believed → Learned → Practiced → Mastered); `timeline_entries` is the
-- append-only history of how they got there, which is what the UI renders.

create table public.topic_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.knowledge_graph (id) on delete cascade,
  stage public.timeline_stage not null default 'believed',
  -- 0–1 confidence that the student really is at this stage.
  confidence real not null default 0.25 check (confidence >= 0 and confidence <= 1),
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, topic_id)
);

create index topic_mastery_user_stage_idx on public.topic_mastery (user_id, stage);

create trigger topic_mastery_set_updated_at
  before update on public.topic_mastery
  for each row execute function public.set_updated_at();

-- Append-only stage transitions.
create table public.timeline_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.knowledge_graph (id) on delete cascade,
  stage public.timeline_stage not null,
  -- Plain-language description of what moved the needle.
  summary text not null,
  -- The event that triggered the transition, when there is one.
  learning_event_id uuid references public.learning_events (id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index timeline_entries_user_occurred_idx
  on public.timeline_entries (user_id, occurred_at desc);

create index timeline_entries_user_topic_idx
  on public.timeline_entries (user_id, topic_id, occurred_at);

-- ---------------------------------------------------------------------------
-- RLS — owner only.
-- ---------------------------------------------------------------------------

alter table public.topic_mastery enable row level security;
alter table public.timeline_entries enable row level security;

create policy "topic_mastery: owner all"
  on public.topic_mastery for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "timeline_entries: owner reads own"
  on public.timeline_entries for select
  using (auth.uid() = user_id);

create policy "timeline_entries: owner inserts own"
  on public.timeline_entries for insert
  with check (auth.uid() = user_id);

-- Deliberately no update/delete: the timeline is a record, not a draft.

-- ---------------------------------------------------------------------------
-- Advancing a topic writes both the current stage and a history entry, so the
-- two can never disagree.
-- ---------------------------------------------------------------------------

create or replace function public.advance_topic_stage(
  target_topic_id uuid,
  new_stage public.timeline_stage,
  -- Not named `summary`: plpgsql defaults to variable_conflict = error, and a
  -- parameter sharing a name with timeline_entries.summary makes the INSERT
  -- below fail with "column reference is ambiguous".
  entry_summary text,
  new_confidence real default null,
  source_event_id uuid default null
)
returns public.topic_mastery
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.topic_mastery;
begin
  if auth.uid() is null then
    raise exception 'advance_topic_stage requires an authenticated caller';
  end if;

  insert into public.topic_mastery (user_id, topic_id, stage, confidence)
  values (
    auth.uid(),
    target_topic_id,
    new_stage,
    coalesce(new_confidence, 0.25)
  )
  on conflict (user_id, topic_id) do update
    set stage = excluded.stage,
        confidence = coalesce(new_confidence, topic_mastery.confidence)
  returning * into result;

  insert into public.timeline_entries (user_id, topic_id, stage, summary, learning_event_id)
  values (auth.uid(), target_topic_id, new_stage, entry_summary, source_event_id);

  return result;
end;
$$;
