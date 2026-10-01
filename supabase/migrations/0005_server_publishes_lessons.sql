-- Only the server (service role, after re-checking keys with SymPy) writes the shared lesson cache.
drop policy if exists "signed-in users publish lessons" on public.lesson_cache;
alter table public.lesson_cache alter column created_by drop not null;
alter table public.lesson_cache alter column created_by drop default;
