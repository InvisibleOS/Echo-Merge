-- Adds priorities.solution_plan — a JSONB blob holding the per-priority
-- assignment/resolution overrides written by /priorities/[id]/assign and
-- /priorities/[id]/resolve (e.g. { assigned, assigned_department, resolved, ... }).
--
-- This column existed in the live Supabase database but was never captured in the
-- migration files; recorded here so a fresh Cloud SQL (or any) Postgres provisioned
-- from these migrations matches the application's expectations.
ALTER TABLE priorities ADD COLUMN IF NOT EXISTS solution_plan JSONB;
