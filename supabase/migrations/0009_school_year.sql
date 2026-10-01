-- Students move up a grade each new school year (June): the grade is what they're learning toward, not a pass/fail status.
-- grade_year is the school year current_grade belongs to, by the year it opened, so every device promotes once.
alter table public.profiles
  add column if not exists grade_year int;
