-- Priorbyte — dashboard customization: nickname + a schemaless preferences
-- blob. No new RLS needed: these are plain columns on profiles, already
-- covered by the existing "profiles: owner reads/updates own" policies —
-- RLS is row-level, not column-level.

alter table public.profiles
  add column nickname text,
  add column dashboard_preferences jsonb not null default '{}'::jsonb;
