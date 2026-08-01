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
