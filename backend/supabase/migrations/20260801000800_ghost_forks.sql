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
