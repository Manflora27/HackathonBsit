-- A quiz or exam carries its own questions, written and checked when the teacher makes it, so every student
-- in the class gets the same test (before, each device pulled whatever its lesson cache held at the time).
-- Older tests have none and still fall back to lesson practice.
alter table public.assignments add column if not exists questions jsonb;
