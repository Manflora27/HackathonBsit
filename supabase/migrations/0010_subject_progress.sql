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
