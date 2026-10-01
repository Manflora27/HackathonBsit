-- Onboarding: what the learner studies and where they say they are.
-- current_grade is self-reported: a starting baseline, never a verified level.
alter table public.profiles
  add column if not exists subjects text[] not null default '{}',
  add column if not exists current_grade int check (current_grade between 1 and 12),
  add column if not exists goal text check (goal in ('catch_up','keep_up','exam_prep','explore')),
  add column if not exists onboarded_at timestamptz;
