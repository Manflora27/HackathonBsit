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
