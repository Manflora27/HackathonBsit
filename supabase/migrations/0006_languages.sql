-- Languages are now BCP 47 codes: English, Tagalog, Bisaya (Cebuano). "fil" was Tagalog.
alter table public.profiles drop constraint if exists profiles_language_check;
update public.profiles set language = 'tl' where language = 'fil';
alter table public.profiles add constraint profiles_language_check check (language in ('en', 'tl', 'ceb'));
