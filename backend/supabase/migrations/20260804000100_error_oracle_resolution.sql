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
