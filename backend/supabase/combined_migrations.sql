-- =============================================================
-- Priorbyte — combined schema (all migrations + seed, in order)
-- Paste this whole file into one Supabase SQL Editor query and Run.
-- =============================================================

-- ===== migrations/20260801000100_extensions_and_enums.sql =====
-- Priorbyte — foundation: extensions, enums, and shared helpers.
-- Everything downstream depends on this migration running first.

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "vector" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums. These mirror the unions in shared/src/constants.ts exactly; changing
-- one without the other will break the typed client.
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('student', 'faculty', 'admin');

create type public.subscription_tier as enum ('free', 'pro', 'teams', 'enterprise');

create type public.timeline_stage as enum ('believed', 'learned', 'practiced', 'mastered');

create type public.chat_sharing_level as enum ('none', 'selected', 'full');

create type public.learning_event_type as enum (
  'note',
  'question',
  'answer',
  'correction',
  'quiz_attempt',
  'code_submission',
  'reading',
  'video'
);

create type public.inoculation_format as enum ('story', 'puzzle', 'analogy', 'counterexample');

create type public.prediction_outcome as enum ('pending', 'prevented', 'occurred', 'expired');

create type public.chat_role as enum ('user', 'assistant');

-- ---------------------------------------------------------------------------
-- Shared trigger helper: keep updated_at honest.
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===== migrations/20260801000200_profiles.sql =====
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

-- ===== migrations/20260801000300_courses.sql =====
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

-- ===== migrations/20260801000400_knowledge_graph.sql =====
-- Priorbyte — the knowledge graph.
--
-- Shared reference data, NOT per-user. Every authenticated user may read it;
-- only admins may write it. Prerequisites are modelled as a separate edge
-- table rather than an array so the graph can be traversed recursively.

create table public.knowledge_graph (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subject text not null,
  summary text,
  -- Known ways students get this topic wrong; seeds the Error Oracle.
  misconceptions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_graph_subject_idx on public.knowledge_graph (subject);

create trigger knowledge_graph_set_updated_at
  before update on public.knowledge_graph
  for each row execute function public.set_updated_at();

-- Directed edge: `prerequisite_id` should be understood before `topic_id`.
create table public.knowledge_graph_edges (
  topic_id uuid not null references public.knowledge_graph (id) on delete cascade,
  prerequisite_id uuid not null references public.knowledge_graph (id) on delete cascade,
  -- 0–1: how strongly the prerequisite gates the topic.
  strength real not null default 1.0 check (strength >= 0 and strength <= 1),
  primary key (topic_id, prerequisite_id),
  constraint no_self_prerequisite check (topic_id <> prerequisite_id)
);

create index knowledge_graph_edges_prereq_idx
  on public.knowledge_graph_edges (prerequisite_id);

-- ---------------------------------------------------------------------------
-- RLS — readable by all signed-in users, writable only by admins.
-- ---------------------------------------------------------------------------

alter table public.knowledge_graph enable row level security;
alter table public.knowledge_graph_edges enable row level security;

create policy "knowledge_graph: authenticated read"
  on public.knowledge_graph for select
  to authenticated
  using (true);

create policy "knowledge_graph: admin writes"
  on public.knowledge_graph for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "knowledge_graph_edges: authenticated read"
  on public.knowledge_graph_edges for select
  to authenticated
  using (true);

create policy "knowledge_graph_edges: admin writes"
  on public.knowledge_graph_edges for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Recursive prerequisite lookup, used by the Error Oracle and the graph UI.
-- ---------------------------------------------------------------------------

create or replace function public.topic_prerequisites(target_topic_id uuid, max_depth int default 5)
returns table (id uuid, slug text, title text, depth int)
language sql
stable
as $$
  with recursive walk as (
    select e.prerequisite_id as id, 1 as depth
    from public.knowledge_graph_edges e
    where e.topic_id = target_topic_id
    union
    select e.prerequisite_id, w.depth + 1
    from public.knowledge_graph_edges e
    join walk w on e.topic_id = w.id
    where w.depth < max_depth
  )
  select kg.id, kg.slug, kg.title, min(w.depth)::int as depth
  from walk w
  join public.knowledge_graph kg on kg.id = w.id
  group by kg.id, kg.slug, kg.title
  order by depth, kg.title;
$$;

-- ===== migrations/20260801000500_learning_events.sql =====
-- Priorbyte — raw captured learning events plus their Voyage AI embeddings.
--
-- This is the highest-volume, most sensitive student-owned table. It is
-- readable only by its owner. Staff never touch it directly; they see
-- aggregates derived elsewhere.

create table public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.learning_event_type not null,
  content text not null check (length(content) between 1 and 20000),
  topic_id uuid references public.knowledge_graph (id) on delete set null,
  course_id uuid references public.courses (id) on delete set null,
  -- Capture origin: page URL, or an extension source label.
  source text,
  -- Voyage AI `voyage-3` output. Must match EMBEDDING_DIMENSIONS in /shared.
  embedding extensions.vector(1024),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index learning_events_user_occurred_idx
  on public.learning_events (user_id, occurred_at desc);

create index learning_events_user_type_idx
  on public.learning_events (user_id, type);

create index learning_events_topic_idx
  on public.learning_events (topic_id)
  where topic_id is not null;

-- HNSW over cosine distance: good recall without needing a trained index,
-- which matters because the table starts empty and grows continuously.
create index learning_events_embedding_idx
  on public.learning_events
  using hnsw (embedding extensions.vector_cosine_ops);

-- Rows still waiting on the embedding Edge Function.
create index learning_events_pending_embedding_idx
  on public.learning_events (created_at)
  where embedding is null;

-- ---------------------------------------------------------------------------
-- RLS — owner only, full stop.
-- ---------------------------------------------------------------------------

alter table public.learning_events enable row level security;

create policy "learning_events: owner reads own"
  on public.learning_events for select
  using (auth.uid() = user_id);

create policy "learning_events: owner inserts own"
  on public.learning_events for insert
  with check (auth.uid() = user_id);

create policy "learning_events: owner updates own"
  on public.learning_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "learning_events: owner deletes own"
  on public.learning_events for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Ghost Memory: vector search over the caller's OWN past events.
--
-- The user_id filter is baked into the function rather than passed in, so
-- there is no parameter a caller could tamper with to read someone else's
-- history. SECURITY INVOKER keeps RLS active as a second line of defence.
-- ---------------------------------------------------------------------------

create or replace function public.match_learning_events(
  query_embedding extensions.vector(1024),
  match_threshold real default 0.7,
  match_count int default 10,
  filter_types public.learning_event_type[] default null
)
returns table (
  id uuid,
  type public.learning_event_type,
  content text,
  topic_id uuid,
  source text,
  occurred_at timestamptz,
  similarity real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    le.id,
    le.type,
    le.content,
    le.topic_id,
    le.source,
    le.occurred_at,
    (1 - (le.embedding <=> query_embedding))::real as similarity
  from public.learning_events le
  where le.user_id = auth.uid()
    and le.embedding is not null
    and (filter_types is null or le.type = any (filter_types))
    and (1 - (le.embedding <=> query_embedding)) >= match_threshold
  order by le.embedding <=> query_embedding
  limit least(match_count, 50);
$$;

-- ===== migrations/20260801000600_ghost_timeline.sql =====
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

-- ===== migrations/20260801000700_vulnerability_and_predictions.sql =====
-- Priorbyte — the predictive core: vulnerability model, Error Oracle output,
-- and inoculation delivery. Phase 2 fills these; the schema lands now so
-- Phase 1 capture already writes into the right shape.

-- ---------------------------------------------------------------------------
-- vulnerability_model — one row per user, rewritten by the daily
-- "Psychic Lattice" cron. Patterns are JSONB because their shape is decided
-- by the model, not by us.
-- ---------------------------------------------------------------------------

create table public.vulnerability_model (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  -- { "<concept-slug>": { label, weight, evidenceCount, relatedTopicIds } }
  patterns jsonb not null default '{}'::jsonb,
  -- 0–1: whether there is enough signal to predict at all.
  confidence real not null default 0 check (confidence >= 0 and confidence <= 1),
  -- How many learning_events fed the current computation.
  events_analyzed int not null default 0,
  last_computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index vulnerability_model_patterns_idx
  on public.vulnerability_model using gin (patterns);

-- ---------------------------------------------------------------------------
-- predicted_errors — Error Oracle output, with its inoculation and outcome.
-- ---------------------------------------------------------------------------

create table public.predicted_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.knowledge_graph (id) on delete cascade,
  -- What the student is expected to get wrong, in plain language.
  prediction text not null,
  -- Which vulnerability pattern drove this prediction.
  pattern_key text,
  confidence real not null default 0.5 check (confidence >= 0 and confidence <= 1),

  -- Inoculation micro-content, generated lazily after the prediction.
  inoculation_format public.inoculation_format,
  inoculation_content text,
  inoculation_delivered_at timestamptz,
  inoculation_acknowledged_at timestamptz,

  outcome public.prediction_outcome not null default 'pending',
  predicted_at timestamptz not null default now(),
  resolved_at timestamptz,

  -- An outcome other than 'pending' must record when it was decided.
  constraint resolved_outcome_has_timestamp check (
    (outcome = 'pending' and resolved_at is null)
    or (outcome <> 'pending' and resolved_at is not null)
  ),
  -- Content and format travel together.
  constraint inoculation_is_complete check (
    (inoculation_format is null and inoculation_content is null)
    or (inoculation_format is not null and inoculation_content is not null)
  )
);

create index predicted_errors_user_outcome_idx
  on public.predicted_errors (user_id, outcome, predicted_at desc);

create index predicted_errors_user_topic_idx
  on public.predicted_errors (user_id, topic_id);

-- The inoculation queue: generated, not yet shown.
create index predicted_errors_undelivered_idx
  on public.predicted_errors (user_id, predicted_at)
  where inoculation_content is not null and inoculation_delivered_at is null;

-- ---------------------------------------------------------------------------
-- RLS — both tables are strictly owner-scoped. The cron and the Oracle run
-- with the service-role key, which bypasses RLS by design.
-- ---------------------------------------------------------------------------

alter table public.vulnerability_model enable row level security;
alter table public.predicted_errors enable row level security;

create policy "vulnerability_model: owner reads own"
  on public.vulnerability_model for select
  using (auth.uid() = user_id);

-- Writes are the cron's job. No owner insert/update policy on purpose: a
-- student must not be able to hand-edit their own vulnerability profile.

create policy "predicted_errors: owner reads own"
  on public.predicted_errors for select
  using (auth.uid() = user_id);

-- Owners may only acknowledge an inoculation — nothing else on the row.
create policy "predicted_errors: owner acknowledges own"
  on public.predicted_errors for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.guard_predicted_error_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role has no auth.uid(); let the pipeline write freely.
  if auth.uid() is null then
    return new;
  end if;

  if new.prediction is distinct from old.prediction
     or new.confidence is distinct from old.confidence
     or new.topic_id is distinct from old.topic_id
     or new.inoculation_content is distinct from old.inoculation_content
     or new.inoculation_format is distinct from old.inoculation_format
     or new.outcome is distinct from old.outcome then
    raise exception 'only inoculation_acknowledged_at may be updated by the owner';
  end if;

  return new;
end;
$$;

create trigger predicted_errors_guard_updates
  before update on public.predicted_errors
  for each row execute function public.guard_predicted_error_updates();

-- ===== migrations/20260801000800_ghost_forks.sql =====
-- Priorbyte — Ghost Fork.
--
-- The counterfactual: the path the student would have taken had the predicted
-- error landed, next to the path they actually took after inoculation.

create table public.ghost_forks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.knowledge_graph (id) on delete cascade,
  predicted_error_id uuid references public.predicted_errors (id) on delete set null,

  -- Both are arrays of { stage, summary, occurredAt }. JSONB because the
  -- original path is a generated counterfactual, not real rows.
  original_path jsonb not null default '[]'::jsonb,
  protected_path jsonb not null default '[]'::jsonb,

  -- Estimated stages-of-mastery saved; drives the headline number in the UI.
  stages_saved int not null default 0,
  created_at timestamptz not null default now(),

  constraint paths_are_arrays check (
    jsonb_typeof(original_path) = 'array' and jsonb_typeof(protected_path) = 'array'
  )
);

create index ghost_forks_user_created_idx on public.ghost_forks (user_id, created_at desc);
create index ghost_forks_user_topic_idx on public.ghost_forks (user_id, topic_id);

alter table public.ghost_forks enable row level security;

create policy "ghost_forks: owner reads own"
  on public.ghost_forks for select
  using (auth.uid() = user_id);

-- Written by the Phase 2 pipeline under the service-role key only.

-- ===== migrations/20260801000900_chat_and_consent.sql =====
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

-- ===== migrations/20260801001000_ai_usage.sql =====
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

-- ===== migrations/20260803000100_auth_hardening.sql =====
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

-- ===== migrations/20260803000200_student_profile_details.sql =====
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

-- ===== migrations/20260803000300_dashboard_preferences.sql =====
-- Priorbyte — dashboard customization: nickname + a schemaless preferences
-- blob. No new RLS needed: these are plain columns on profiles, already
-- covered by the existing "profiles: owner reads/updates own" policies —
-- RLS is row-level, not column-level.

alter table public.profiles
  add column nickname text,
  add column dashboard_preferences jsonb not null default '{}'::jsonb;

-- ===== migrations/20260803000400_username_at_signup.sql =====
-- Priorbyte — username moves to the sign-up form itself, which runs before
-- a session exists. is_username_available() needs to be callable by `anon`
-- for the same reason request_magic_link_allowed() already is.

grant execute on function public.is_username_available(text) to anon;

-- ===== migrations/20260803000500_numeric_year_levels.sql =====
-- Priorbyte — switch year_level from US class-year names to numeric years,
-- which is what most institutions outside the US actually use.
--
-- RENAME VALUE preserves any rows already using the old labels; there's
-- nothing to backfill.

alter type public.year_level rename value 'freshman' to 'year_1';
alter type public.year_level rename value 'sophomore' to 'year_2';
alter type public.year_level rename value 'junior' to 'year_3';
alter type public.year_level rename value 'senior' to 'year_4';

-- ===== migrations/20260804000100_error_oracle_resolution.sql =====
-- Priorbyte — let a student resolve their own predicted-error outcome.
--
-- Phase 2 needs the student themselves to say "this helped" or "I made the
-- mistake anyway" (there's no reliable automatic way to detect that from
-- captured events alone). The existing guard trigger blocked ANY owner
-- change to `outcome`, which made that impossible. Narrowed instead of
-- removed: the owner may only move pending -> prevented/occurred, exactly
-- once, and only together with resolved_at — every other field, and every
-- other transition, stays blocked.

create or replace function public.guard_predicted_error_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role has no auth.uid(); let the pipeline write freely.
  if auth.uid() is null then
    return new;
  end if;

  if new.prediction is distinct from old.prediction
     or new.confidence is distinct from old.confidence
     or new.topic_id is distinct from old.topic_id
     or new.inoculation_content is distinct from old.inoculation_content
     or new.inoculation_format is distinct from old.inoculation_format then
    raise exception 'only inoculation_acknowledged_at and outcome resolution may be updated by the owner';
  end if;

  if new.outcome is distinct from old.outcome then
    if old.outcome <> 'pending' then
      raise exception 'this prediction has already been resolved';
    end if;
    if new.outcome not in ('prevented', 'occurred') then
      raise exception 'owner may only resolve to prevented or occurred';
    end if;
    if new.resolved_at is null then
      raise exception 'resolved_at must be set in the same update as outcome';
    end if;
  end if;

  return new;
end;
$$;

-- ===== seed.sql =====
-- Priorbyte — seed data for local development.
--
-- Only shared reference data (the knowledge graph). No fake users, no fake
-- learning events: student data must always be real capture.

insert into public.knowledge_graph (slug, title, subject, summary, misconceptions) values
  ('limits', 'Limits', 'Calculus',
   'The value a function approaches as its input approaches some point.',
   array[
     'Treating a limit as the value the function takes at the point',
     'Assuming a limit fails to exist whenever the function is undefined there'
   ]),
  ('derivatives', 'Derivatives', 'Calculus',
   'Instantaneous rate of change, defined as the limit of a difference quotient.',
   array[
     'Applying the power rule to the exponent of an exponential function',
     'Forgetting the chain rule on composed functions',
     'Reading the derivative as slope of the function rather than of the tangent'
   ]),
  ('chain-rule', 'Chain Rule', 'Calculus',
   'Differentiating a composition of functions.',
   array[
     'Differentiating the outer function without multiplying by the inner derivative',
     'Misidentifying which function is inner and which is outer'
   ]),
  ('integrals', 'Integrals', 'Calculus',
   'Accumulation, and the inverse of differentiation.',
   array[
     'Dropping the constant of integration',
     'Treating definite and indefinite integrals as interchangeable'
   ]),

  ('big-o', 'Big-O Notation', 'Computer Science',
   'Asymptotic upper bound on the growth of an algorithm''s cost.',
   array[
     'Reading Big-O as exact running time rather than an upper bound',
     'Keeping constant factors and lower-order terms',
     'Confusing worst case with average case'
   ]),
  ('recursion', 'Recursion', 'Computer Science',
   'A function defined in terms of itself, with a base case that terminates it.',
   array[
     'Omitting or mis-stating the base case',
     'Assuming recursion is always more expensive than iteration',
     'Losing track of what the call stack holds between calls'
   ]),
  ('pointers', 'Pointers and References', 'Computer Science',
   'Values that hold the location of other values.',
   array[
     'Confusing the pointer with the thing it points at',
     'Assuming assignment copies the underlying object'
   ]),

  ('newtons-laws', 'Newton''s Laws', 'Physics',
   'The three laws relating force, mass, and motion.',
   array[
     'Believing motion requires a continuously applied force',
     'Pairing action and reaction forces on the same body'
   ]),
  ('conservation-of-energy', 'Conservation of Energy', 'Physics',
   'Energy in a closed system is constant; it changes form rather than amount.',
   array[
     'Treating energy as consumed rather than converted',
     'Ignoring energy lost to friction when checking the balance'
   ])
on conflict (slug) do nothing;

-- Prerequisite edges.
insert into public.knowledge_graph_edges (topic_id, prerequisite_id, strength)
select t.id, p.id, 1.0
from (values
  ('derivatives', 'limits'),
  ('chain-rule', 'derivatives'),
  ('integrals', 'derivatives'),
  ('recursion', 'big-o'),
  ('conservation-of-energy', 'newtons-laws')
) as e(topic_slug, prereq_slug)
join public.knowledge_graph t on t.slug = e.topic_slug
join public.knowledge_graph p on p.slug = e.prereq_slug
on conflict do nothing;

