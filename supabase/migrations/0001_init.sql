-- Gap Finder schema. Learners own their accounts; classes are memberships.
-- Row Level Security enforces who sees what (RA 10173: proportional access).

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  language text not null default 'en' check (language in ('en','fil')),
  birth_year int,
  guardian_consent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  section text,
  class_code text not null unique,
  owner_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid not null references public.profiles on delete cascade,
  class_id uuid not null references public.classes on delete cascade,
  role text not null check (role in ('student','teacher')),
  share_skill_map boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (user_id, class_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes on delete cascade,
  title text not null,
  problem_ids text[] not null default '{}',
  target_skill_id text,          -- set for gap-practice assignments
  student_ids uuid[],            -- null = whole class
  due_at timestamptz,
  created_by uuid not null references public.profiles,
  created_at timestamptz not null default now()
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  assignment_id uuid references public.assignments on delete set null, -- null = self-practice
  problem_id text not null,
  steps jsonb not null,
  diagnosis jsonb not null,      -- engine output: error line, wrong terms, misconception, confidence
  root_skill text,
  visibility text not null default 'private' check (visibility in ('private','class')),
  teacher_override jsonb,
  created_at timestamptz not null default now()
);

create table public.skill_progress (
  user_id uuid not null references public.profiles on delete cascade,
  skill_id text not null,
  status text not null check (status in ('unknown','gap','mastered')),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table public.ai_log (
  id bigint generated always as identity primary key,
  attempt_id uuid references public.attempts on delete cascade,
  actor_id uuid references public.profiles on delete set null,
  action text not null,
  ai_suggestion text,
  human_decision text,
  created_at timestamptz not null default now()
);

create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  type text not null,            -- 'data_processing', 'voice'
  version text not null,
  given_by text not null check (given_by in ('self','guardian','school')),
  created_at timestamptz not null default now()
);

-- Shared AI response cache (no personal data: keyed by skill + misconception + language).
create table public.ai_cache (
  key text primary key,
  explanation text,
  spoken text,
  audio_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Is the caller an active teacher of a class this student actively belongs to?
create or replace function public.teaches(student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from memberships t
    join memberships s on s.class_id = t.class_id
    where t.user_id = auth.uid() and t.role = 'teacher' and t.left_at is null
      and s.user_id = student and s.role = 'student' and s.left_at is null
  );
$$;

create or replace function public.shares_map_with_me(student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from memberships t
    join memberships s on s.class_id = t.class_id
    where t.user_id = auth.uid() and t.role = 'teacher' and t.left_at is null
      and s.user_id = student and s.role = 'student' and s.left_at is null and s.share_skill_map
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.memberships enable row level security;
alter table public.assignments enable row level security;
alter table public.attempts enable row level security;
alter table public.skill_progress enable row level security;
alter table public.ai_log enable row level security;
alter table public.consents enable row level security;
alter table public.ai_cache enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "teacher sees class profiles" on public.profiles for select using (public.teaches(id));

create policy "members see their classes" on public.classes for select
  using (owner_id = auth.uid() or exists (select 1 from memberships m where m.class_id = id and m.user_id = auth.uid() and m.left_at is null));
create policy "teachers create classes" on public.classes for insert with check (owner_id = auth.uid());

create policy "own memberships" on public.memberships for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "teacher sees roster" on public.memberships for select
  using (exists (select 1 from memberships t where t.class_id = memberships.class_id and t.user_id = auth.uid() and t.role = 'teacher'));

create policy "class sees assignments" on public.assignments for select
  using (exists (select 1 from memberships m where m.class_id = assignments.class_id and m.user_id = auth.uid() and m.left_at is null));
create policy "teacher writes assignments" on public.assignments for all
  using (exists (select 1 from memberships m where m.class_id = assignments.class_id and m.user_id = auth.uid() and m.role = 'teacher'))
  with check (created_by = auth.uid());

-- Students own all their attempts; teachers see only class-visible ones.
create policy "own attempts" on public.attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "teacher sees assigned work" on public.attempts for select
  using (visibility = 'class' and public.teaches(user_id));
create policy "teacher overrides diagnosis" on public.attempts for update
  using (visibility = 'class' and public.teaches(user_id));

create policy "own progress" on public.skill_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "teacher sees shared maps" on public.skill_progress for select using (public.shares_map_with_me(user_id));

create policy "own ai log" on public.ai_log for all using (actor_id = auth.uid()) with check (actor_id = auth.uid());
create policy "own consents" on public.consents for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "read cache" on public.ai_cache for select using (true);

-- ---------------------------------------------------------------------------
-- Teacher dashboard: students sharing each root gap, per class (no names).
-- ---------------------------------------------------------------------------
create or replace view public.class_gap_summary with (security_invoker = true) as
select m.class_id, a.root_skill as skill_id, count(distinct a.user_id) as students
from public.attempts a
join public.memberships m on m.user_id = a.user_id and m.role = 'student' and m.left_at is null
where a.visibility = 'class' and a.root_skill is not null
group by m.class_id, a.root_skill;

-- Live dashboard updates
alter publication supabase_realtime add table public.attempts, public.skill_progress;
