-- Classes teach one subject at one grade, and teachers see a student only through the quizzes and
-- exams they send to that class. No skill maps, no self-practice: a teacher's view of a learner is
-- proportional to what that teacher asked of them (RA 10173).

alter table public.classes
  add column if not exists subject text,
  add column if not exists grade int check (grade between 1 and 12);

-- A test is a quiz (one topic) or an exam (several), drawn from the class's curriculum units.
alter table public.assignments
  add column if not exists kind text check (kind in ('quiz','exam','practice')) default 'practice',
  add column if not exists unit_ids text[] not null default '{}';

-- One result per student per test. The student writes it; their teacher reads it.
create table if not exists public.assignment_results (
  assignment_id uuid not null references public.assignments on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  score int not null check (score >= 0),
  total int not null check (total > 0 and score <= total),
  -- per item: { unit_id, right } only. No typed answers leave the device.
  items jsonb not null default '[]',
  submitted_at timestamptz not null default now(),
  primary key (assignment_id, user_id)
);
alter table public.assignment_results enable row level security;

-- Is the caller an active student of the class this assignment belongs to?
create or replace function public.can_take(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from assignments a join memberships m on m.class_id = a.class_id
    where a.id = aid and m.user_id = auth.uid() and m.role = 'student' and m.left_at is null
      and (a.student_ids is null or auth.uid() = any (a.student_ids))
  );
$$;

-- Is the caller the active teacher of this assignment's class, and the student still in it?
create or replace function public.sees_result(aid uuid, student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from assignments a
    join memberships t on t.class_id = a.class_id and t.user_id = auth.uid() and t.role = 'teacher' and t.left_at is null
    join memberships s on s.class_id = a.class_id and s.user_id = student and s.role = 'student' and s.left_at is null
    where a.id = aid
  );
$$;

drop policy if exists "own results" on public.assignment_results;
create policy "own results" on public.assignment_results for select using (user_id = auth.uid());
drop policy if exists "submit own result" on public.assignment_results;
create policy "submit own result" on public.assignment_results for insert
  with check (user_id = auth.uid() and public.can_take(assignment_id));
drop policy if exists "teacher sees results of their tests" on public.assignment_results;
create policy "teacher sees results of their tests" on public.assignment_results for select
  using (public.sees_result(assignment_id, user_id));

-- Students see only the tests meant for them (whole class, or picked by name).
drop policy if exists "class sees assignments" on public.assignments;
create policy "class sees assignments" on public.assignments for select
  using (public.is_teacher_of(class_id) or public.can_take(id));

-- Teachers no longer read skill maps, and see attempts only on work they assigned to their class.
drop policy if exists "teacher sees shared maps" on public.skill_progress;
drop policy if exists "teacher sees assigned work" on public.attempts;
create policy "teacher sees assigned work" on public.attempts for select
  using (visibility = 'class' and assignment_id is not null and public.sees_result(assignment_id, user_id));
drop policy if exists "teacher overrides diagnosis" on public.attempts;
create policy "teacher overrides diagnosis" on public.attempts for update
  using (visibility = 'class' and assignment_id is not null and public.sees_result(assignment_id, user_id));

-- Teachers see classmates' names only for their own classes (already: "teacher sees class profiles").

revoke all on function public.can_take(uuid) from public;
revoke all on function public.sees_result(uuid, uuid) from public;
grant execute on function public.can_take(uuid) to authenticated;
grant execute on function public.sees_result(uuid, uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.assignment_results;
exception when duplicate_object then null; end $$;
