-- Simple welcome-gate entries (no Supabase Auth required)
-- Applied remotely to project bpazrlmozjrxnrkfrvrq (Invis).

create table if not exists public.app_entries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue text,
  email text,
  kind text not null default 'tester'
    check (kind = any (array['kitchen'::text, 'tester'::text])),
  created_at timestamptz not null default now()
);

create index if not exists app_entries_created_at_idx
  on public.app_entries (created_at desc);

alter table public.app_entries enable row level security;
alter table public.app_entries force row level security;

drop policy if exists "Anyone can insert app entries" on public.app_entries;
create policy "Anyone can insert app entries"
  on public.app_entries for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Anyone can read app entries" on public.app_entries;
create policy "Anyone can read app entries"
  on public.app_entries for select
  to anon, authenticated
  using (true);

drop policy if exists "Users insert feedback" on public.feedback;
drop policy if exists "Users read own feedback or admin" on public.feedback;
drop policy if exists "Anyone can insert feedback" on public.feedback;
drop policy if exists "Anyone can read feedback" on public.feedback;

create policy "Anyone can insert feedback"
  on public.feedback for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can read feedback"
  on public.feedback for select
  to anon, authenticated
  using (true);

alter table public.feedback alter column user_id drop not null;
