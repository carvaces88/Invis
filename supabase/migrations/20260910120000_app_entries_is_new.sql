-- Welcome-gate “I’m a new user” flag for traction metrics.
alter table public.app_entries
  add column if not exists is_new boolean not null default false;

comment on column public.app_entries.is_new is
  'Welcome-gate “I’m a new user” checkbox — empty inventory start for traction testers.';
