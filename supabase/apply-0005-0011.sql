-- Brings a project that has migrations 0001-0004 up to date: paste into Supabase > SQL Editor and run once.
-- Generated from supabase/migrations/0005..0011 (each is safe to re-run). One transaction: all or nothing.
begin;

-- ===== 0005_server_publishes_lessons.sql =====
-- Only the server (service role, after re-checking keys with SymPy) writes the shared lesson cache.
drop policy if exists "signed-in users publish lessons" on public.lesson_cache;
alter table public.lesson_cache alter column created_by drop not null;
alter table public.lesson_cache alter column created_by drop default;

-- ===== 0006_languages.sql =====
-- Languages are now BCP 47 codes: English, Tagalog, Bisaya (Cebuano). "fil" was Tagalog.
alter table public.profiles drop constraint if exists profiles_language_check;
update public.profiles set language = 'tl' where language = 'fil';
alter table public.profiles add constraint profiles_language_check check (language in ('en', 'tl', 'ceb'));

-- ===== 0007_remove_student.sql =====
-- Teachers can remove a student from their class. The student keeps everything: attempts and
-- skill progress belong to the student, not the class, so nothing is deleted. Removal only ends
-- the membership, which ends the teacher's view (teaches() and shares_map_with_me() need left_at is null).
alter table public.memberships add column if not exists removed_at timestamptz;

-- Only the functions below may change removed_at, or bring back a removed membership.
-- Without this, "own memberships" would let a removed student clear it through the API.
create or replace function public.guard_membership_removal() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('hopper.membership_admin', true), '') = 'on' then return new; end if;
  if new.removed_at is distinct from old.removed_at
     or (old.removed_at is not null and new.left_at is distinct from old.left_at) then
    raise exception 'removed from this class';
  end if;
  return new;
end $$;
drop trigger if exists guard_membership_removal on public.memberships;
create trigger guard_membership_removal before update on public.memberships
  for each row execute function public.guard_membership_removal();

create or replace function public.remove_student(cid uuid, student uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher_of(cid) then raise exception 'not your class'; end if;
  perform set_config('hopper.membership_admin', 'on', true);
  update memberships set left_at = now(), removed_at = now()
    where class_id = cid and user_id = student and role = 'student' and left_at is null;
  if not found then raise exception 'not in this class'; end if;
end $$;

-- Undo: the student is back in the class, with the same sharing choice as before.
create or replace function public.readmit_student(cid uuid, student uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher_of(cid) then raise exception 'not your class'; end if;
  perform set_config('hopper.membership_admin', 'on', true);
  update memberships set left_at = null, removed_at = null
    where class_id = cid and user_id = student and role = 'student' and removed_at is not null;
end $$;

-- Joining by code: a removed student can't let themselves back in; their teacher can.
create or replace function public.join_class(code text) returns public.classes
language plpgsql security definer set search_path = public as $$
declare c public.classes;
begin
  select * into c from classes where upper(class_code) = upper(trim(code));
  if not found then raise exception 'invalid class code'; end if;
  if exists (select 1 from memberships where user_id = auth.uid() and class_id = c.id and removed_at is not null) then
    raise exception 'removed from this class';
  end if;
  insert into memberships (user_id, class_id, role) values (auth.uid(), c.id, 'student')
    on conflict (user_id, class_id) do update set left_at = null;
  return c;
end $$;

revoke all on function public.remove_student(uuid, uuid) from public;
revoke all on function public.readmit_student(uuid, uuid) from public;
revoke all on function public.join_class(text) from public;
grant execute on function public.remove_student(uuid, uuid) to authenticated;
grant execute on function public.readmit_student(uuid, uuid) to authenticated;
grant execute on function public.join_class(text) to authenticated;

-- ===== 0008_class_tests.sql =====
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

-- ===== 0009_school_year.sql =====
-- Students move up a grade each new school year (June): the grade is what they're learning toward, not a pass/fail status.
-- grade_year is the school year current_grade belongs to, by the year it opened, so every device promotes once.
alter table public.profiles
  add column if not exists grade_year int;

-- ===== 0010_subject_progress.sql =====
-- A teacher sees a student's progress in the class's subject, and nothing else of their learning.
-- Replaces the old all-or-nothing "share my skill map" switch (already unreadable since 0008), which is removed.
-- Progress rows are keyed by plan unit id, which starts with the subject ("math-g8-q1-na", "physics-g11-..."),
-- so a Math class sees math-* rows only: no other subject, no practice answers, no traced mistakes.

drop policy if exists "teacher sees shared maps" on public.skill_progress;
drop function if exists public.shares_map_with_me(uuid);
alter table public.memberships drop column if exists share_skill_map;

-- True when I teach a class this student is currently in, and the row is a unit of that class's subject.
create or replace function public.sees_subject_progress(student uuid, skill text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from memberships t
    join memberships s on s.class_id = t.class_id
    join classes c on c.id = t.class_id
    where t.user_id = auth.uid() and t.role = 'teacher' and t.left_at is null
      and s.user_id = student and s.role = 'student' and s.left_at is null
      and c.subject is not null and skill like c.subject || '-g%'
  );
$$;

drop policy if exists "teacher sees class subject progress" on public.skill_progress;
create policy "teacher sees class subject progress" on public.skill_progress for select
  using (public.sees_subject_progress(user_id, skill_id));

-- What a class code leads to, before joining: so the student can see who will see what, and say yes.
-- Only the class's own label and its teacher's display name; nothing about other members.
create or replace function public.class_preview(code text)
returns table (name text, section text, subject text, grade int, teacher text, removed boolean)
language sql stable security definer set search_path = public as $$
  select c.name, c.section, c.subject, c.grade, p.display_name,
    exists (select 1 from memberships m where m.class_id = c.id and m.user_id = auth.uid() and m.removed_at is not null)
  from classes c
  left join profiles p on p.id = c.owner_id
  where upper(c.class_code) = upper(trim(code));
$$;

revoke all on function public.sees_subject_progress(uuid, text) from public;
revoke all on function public.class_preview(text) from public;
grant execute on function public.sees_subject_progress(uuid, text) to authenticated;
grant execute on function public.class_preview(text) to authenticated;

-- ===== 0011_test_questions.sql =====
-- A quiz or exam carries its own questions, written and checked when the teacher makes it, so every student
-- in the class gets the same test (before, each device pulled whatever its lesson cache held at the time).
-- Older tests have none and still fall back to lesson practice.
alter table public.assignments add column if not exists questions jsonb;

commit;
