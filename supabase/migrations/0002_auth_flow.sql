-- Real sign-in flow: account type, recursion-safe roster policy, join-by-code.
alter table public.profiles add column if not exists account_type text check (account_type in ('student','teacher'));

create or replace function public.is_teacher_of(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where class_id = cid and user_id = auth.uid() and role = 'teacher' and left_at is null);
$$;

-- The original roster policy queried memberships from inside a memberships policy (infinite recursion).
drop policy if exists "teacher sees roster" on public.memberships;
create policy "teacher sees roster" on public.memberships for select using (public.is_teacher_of(class_id));

-- Students can't read classes they aren't in yet, so joining by code goes through this function.
create or replace function public.join_class(code text) returns public.classes
language plpgsql security definer set search_path = public as $$
declare c public.classes;
begin
  select * into c from classes where upper(class_code) = upper(trim(code));
  if not found then raise exception 'invalid class code'; end if;
  insert into memberships (user_id, class_id, role) values (auth.uid(), c.id, 'student')
    on conflict (user_id, class_id) do update set left_at = null;
  return c;
end $$;
revoke all on function public.join_class(text) from public;
grant execute on function public.join_class(text) to authenticated;
