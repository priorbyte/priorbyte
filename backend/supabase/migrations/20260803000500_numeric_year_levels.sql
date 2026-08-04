-- Priorbyte — switch year_level from US class-year names to numeric years,
-- which is what most institutions outside the US actually use.
--
-- RENAME VALUE preserves any rows already using the old labels; there's
-- nothing to backfill.

alter type public.year_level rename value 'freshman' to 'year_1';
alter type public.year_level rename value 'sophomore' to 'year_2';
alter type public.year_level rename value 'junior' to 'year_3';
alter type public.year_level rename value 'senior' to 'year_4';
