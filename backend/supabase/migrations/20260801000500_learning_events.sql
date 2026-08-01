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
