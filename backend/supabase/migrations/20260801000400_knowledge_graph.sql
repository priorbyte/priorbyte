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
