-- Workspace snapshots: sync inventory data across phone + web for the same gate email.
-- Beta MVP — workspace_key is normalized email; replace with auth.uid() when Auth ships.

create table if not exists public.workspace_snapshots (
  workspace_key text primary key,
  email text not null,
  venue text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists workspace_snapshots_updated_at_idx
  on public.workspace_snapshots (updated_at desc);

alter table public.workspace_snapshots enable row level security;
alter table public.workspace_snapshots force row level security;

drop policy if exists "Workspace snapshots read" on public.workspace_snapshots;
create policy "Workspace snapshots read"
  on public.workspace_snapshots
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Workspace snapshots insert" on public.workspace_snapshots;
create policy "Workspace snapshots insert"
  on public.workspace_snapshots
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Workspace snapshots update" on public.workspace_snapshots;
create policy "Workspace snapshots update"
  on public.workspace_snapshots
  for update
  to anon, authenticated
  using (true)
  with check (true);
