-- Multi-venue tenancy for Invis / Inventaario
-- Apply via Supabase SQL editor or: supabase db push
-- Every business row is scoped by venue_id; RLS is the security boundary.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Core tenancy
-- ---------------------------------------------------------------------------

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 1),
  slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists venues_slug_uidx
  on public.venues (slug)
  where slug is not null;

create table if not exists public.venue_members (
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

create index if not exists venue_members_user_idx
  on public.venue_members (user_id);

-- ---------------------------------------------------------------------------
-- Domain tables (all venue-scoped)
-- ---------------------------------------------------------------------------

create table if not exists public.places (
  id text not null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  kind text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (venue_id, id)
);

create index if not exists places_venue_updated_idx
  on public.places (venue_id, updated_at);

create table if not exists public.products (
  id text not null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  official_name text not null,
  unit text not null,
  pack_size text,
  units_per_pack numeric,
  pack_base_unit text,
  unit_price_alv0 numeric not null default 0,
  ingredient_type text not null default 'other',
  aliases jsonb not null default '[]'::jsonb,
  section text,
  low_stock_threshold numeric,
  is_top boolean not null default false,
  image_url text,
  ean text,
  product_code text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (venue_id, id)
);

create index if not exists products_venue_updated_idx
  on public.products (venue_id, updated_at);
create index if not exists products_venue_ean_idx
  on public.products (venue_id, ean)
  where ean is not null;

create table if not exists public.inventory_sessions (
  id text not null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  title text not null default 'Inventory sheet',
  date date not null default (timezone('utc', now())::date),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (venue_id, id)
);

create table if not exists public.inventory_lines (
  id text not null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  session_id text not null,
  product_id text not null,
  place_id text not null,
  quantity numeric,
  official_name text not null,
  unit text not null,
  unit_price_alv0 numeric not null default 0,
  expiry_date date,
  notes text,
  counted_at timestamptz,
  last_updated_at timestamptz,
  verification_status text
    check (
      verification_status is null
      or verification_status in ('pending', 'correct', 'incorrect')
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (venue_id, id),
  unique (venue_id, product_id, place_id),
  foreign key (venue_id, session_id)
    references public.inventory_sessions (venue_id, id) on delete cascade,
  -- product_id is not FK: seed catalog SKUs stay local until promoted;
  -- custom products live in public.products and sync independently.
  foreign key (venue_id, place_id)
    references public.places (venue_id, id) on delete cascade
);

create index if not exists inventory_lines_venue_updated_idx
  on public.inventory_lines (venue_id, updated_at);
create index if not exists inventory_lines_venue_product_idx
  on public.inventory_lines (venue_id, product_id);
create index if not exists inventory_lines_venue_place_idx
  on public.inventory_lines (venue_id, place_id);

create table if not exists public.stock_movements (
  id text not null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  type text not null
    check (type in ('inventory_count', 'kuorma_in', 'havikki_out', 'adjustment')),
  product_id text not null,
  official_name text not null,
  unit text not null,
  quantity_delta numeric not null,
  quantity_after numeric,
  notes text,
  station text,
  source text,
  created_at timestamptz not null default now(),
  primary key (venue_id, id)
);

create index if not exists stock_movements_venue_created_idx
  on public.stock_movements (venue_id, created_at desc);

create table if not exists public.havikki_entries (
  id text not null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  date date not null,
  station text,
  product_id text not null,
  official_name text not null,
  quantity numeric not null,
  unit text not null,
  notes text,
  created_at timestamptz not null default now(),
  primary key (venue_id, id)
);

create index if not exists havikki_entries_venue_created_idx
  on public.havikki_entries (venue_id, created_at desc);

-- Shared K-Ruoka / distributor cache (global, not tenant-secret)
create table if not exists public.product_ean_cache (
  ean text primary key,
  payload jsonb not null,
  source text not null default 'kruoka',
  updated_at timestamptz not null default now()
);

-- Per-venue API quota counters (vision, lookup, …)
create table if not exists public.api_usage (
  venue_id uuid not null references public.venues (id) on delete cascade,
  day date not null default (timezone('utc', now())::date),
  endpoint text not null,
  count int not null default 0 check (count >= 0),
  primary key (venue_id, day, endpoint)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists venues_set_updated_at on public.venues;
create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

drop trigger if exists places_set_updated_at on public.places;
create trigger places_set_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists inventory_sessions_set_updated_at on public.inventory_sessions;
create trigger inventory_sessions_set_updated_at
  before update on public.inventory_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists inventory_lines_set_updated_at on public.inventory_lines;
create trigger inventory_lines_set_updated_at
  before update on public.inventory_lines
  for each row execute function public.set_updated_at();

-- Membership helper used by RLS (stable, security definer, locked search_path)
create or replace function public.is_venue_member(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.venue_members m
    where m.venue_id = p_venue_id
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_venue_member(uuid) from public;
grant execute on function public.is_venue_member(uuid) to authenticated;

create or replace function public.user_venue_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.venue_id
  from public.venue_members m
  where m.user_id = auth.uid();
$$;

revoke all on function public.user_venue_ids() from public;
grant execute on function public.user_venue_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic signup: venue + owner membership + default places + empty session
-- ---------------------------------------------------------------------------

create or replace function public.create_venue_with_owner(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_name text := nullif(trim(p_name), '');
  v_session_id text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_name is null then
    raise exception 'Venue name required';
  end if;

  insert into public.venues (name)
  values (v_name)
  returning id into v_id;

  insert into public.venue_members (venue_id, user_id, role)
  values (v_id, v_uid, 'owner');

  insert into public.places (id, venue_id, name, kind, sort_order) values
    ('place-main', v_id, 'Main kitchen', 'kitchen', 0),
    ('place-freezer', v_id, 'Freezer', 'freezer', 1),
    ('place-pantry', v_id, 'Dry storage', 'pantry', 2);

  v_session_id := 'session-' || replace(v_id::text, '-', '');

  insert into public.inventory_sessions (id, venue_id, title, date, status)
  values (v_session_id, v_id, 'Inventory sheet', timezone('utc', now())::date, 'in_progress');

  return v_id;
end;
$$;

revoke all on function public.create_venue_with_owner(text) from public;
grant execute on function public.create_venue_with_owner(text) to authenticated;

-- Rate-limit helper: returns true if under quota after increment
create or replace function public.check_and_increment_api_usage(
  p_venue_id uuid,
  p_endpoint text,
  p_daily_limit int default 200
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_day date := (timezone('utc', now())::date);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_venue_member(p_venue_id) then
    raise exception 'Not a venue member';
  end if;

  insert into public.api_usage (venue_id, day, endpoint, count)
  values (p_venue_id, v_day, p_endpoint, 1)
  on conflict (venue_id, day, endpoint)
  do update set count = public.api_usage.count + 1
  returning count into v_count;

  return v_count <= greatest(p_daily_limit, 1);
end;
$$;

revoke all on function public.check_and_increment_api_usage(uuid, text, int) from public;
grant execute on function public.check_and_increment_api_usage(uuid, text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.venues enable row level security;
alter table public.venue_members enable row level security;
alter table public.places enable row level security;
alter table public.products enable row level security;
alter table public.inventory_sessions enable row level security;
alter table public.inventory_lines enable row level security;
alter table public.stock_movements enable row level security;
alter table public.havikki_entries enable row level security;
alter table public.product_ean_cache enable row level security;
alter table public.api_usage enable row level security;

-- venues
drop policy if exists venues_select_member on public.venues;
create policy venues_select_member on public.venues
  for select to authenticated
  using (public.is_venue_member(id));

drop policy if exists venues_update_owner on public.venues;
create policy venues_update_owner on public.venues
  for update to authenticated
  using (
    exists (
      select 1 from public.venue_members m
      where m.venue_id = id and m.user_id = auth.uid() and m.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.venue_members m
      where m.venue_id = id and m.user_id = auth.uid() and m.role = 'owner'
    )
  );

-- venue_members
drop policy if exists venue_members_select_own on public.venue_members;
create policy venue_members_select_own on public.venue_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_venue_member(venue_id)
  );

drop policy if exists venue_members_insert_owner on public.venue_members;
create policy venue_members_insert_owner on public.venue_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.venue_members m
      where m.venue_id = venue_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- Generic venue-scoped CRUD for members
drop policy if exists places_member_all on public.places;
create policy places_member_all on public.places
  for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

drop policy if exists products_member_all on public.products;
create policy products_member_all on public.products
  for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

drop policy if exists inventory_sessions_member_all on public.inventory_sessions;
create policy inventory_sessions_member_all on public.inventory_sessions
  for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

drop policy if exists inventory_lines_member_all on public.inventory_lines;
create policy inventory_lines_member_all on public.inventory_lines
  for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

drop policy if exists stock_movements_member_all on public.stock_movements;
create policy stock_movements_member_all on public.stock_movements
  for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

drop policy if exists havikki_entries_member_all on public.havikki_entries;
create policy havikki_entries_member_all on public.havikki_entries
  for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

-- EAN cache: authenticated read; writes via service role or members upsert
drop policy if exists product_ean_cache_select on public.product_ean_cache;
create policy product_ean_cache_select on public.product_ean_cache
  for select to authenticated
  using (true);

drop policy if exists product_ean_cache_upsert on public.product_ean_cache;
create policy product_ean_cache_upsert on public.product_ean_cache
  for insert to authenticated
  with check (true);

drop policy if exists product_ean_cache_update on public.product_ean_cache;
create policy product_ean_cache_update on public.product_ean_cache
  for update to authenticated
  using (true)
  with check (true);

-- api_usage: members can read their venue counters
drop policy if exists api_usage_select_member on public.api_usage;
create policy api_usage_select_member on public.api_usage
  for select to authenticated
  using (public.is_venue_member(venue_id));

-- Realtime (optional): inventory_lines for multi-device kitchens
do $$
begin
  alter publication supabase_realtime add table public.inventory_lines;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
