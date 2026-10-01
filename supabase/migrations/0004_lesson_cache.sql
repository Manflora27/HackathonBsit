-- Shared lesson cache: curriculum-level content, no student data. First writer wins; rows are immutable.
-- `verified` means every practice key passed the engine before publishing. Known gap: the engine runs in the
-- browser, so a hostile client could publish unverified content. Follow-up: re-check on the server.
create table public.lesson_cache (
  unit_id text primary key,
  content jsonb not null,
  verified boolean not null default false,
  verifier text not null,
  created_by uuid not null default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
alter table public.lesson_cache enable row level security;
create policy "signed-in users read lessons" on public.lesson_cache for select to authenticated using (true);
create policy "signed-in users publish lessons" on public.lesson_cache for insert to authenticated with check (created_by = auth.uid());
