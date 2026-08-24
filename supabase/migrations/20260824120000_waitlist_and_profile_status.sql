-- Waitlist registry + profile access status for email-OTP onboarding.
-- Gate the app on profiles.status = 'active'; waitlist mirrors signup intent.
-- Applied remotely to project bpazrlmozjrxnrkfrvrq (Invis) via Supabase MCP.

-- 1) Profile status (soft gate until active)
alter table public.profiles
  add column if not exists status text not null default 'waitlist';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_status_check
      check (status = any (array['waitlist'::text, 'active'::text, 'rejected'::text]));
  end if;
end $$;

create index if not exists profiles_status_idx on public.profiles (status);

-- Existing kitchen accounts stay fully active
update public.profiles
set status = 'active'
where role = 'admin' or username in ('cesar', 'elena', 'ivan', 'guest');

-- 2) Waitlist table (user registry)
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  status text not null default 'pending'
    check (status = any (array['pending'::text, 'approved'::text, 'rejected'::text])),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waitlist_user_id_key unique (user_id),
  constraint waitlist_email_key unique (email)
);

create index if not exists waitlist_status_idx on public.waitlist (status);
create index if not exists waitlist_created_at_idx on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;
alter table public.waitlist force row level security;

drop policy if exists "Users read own waitlist or admin" on public.waitlist;
create policy "Users read own waitlist or admin"
  on public.waitlist
  for select
  to authenticated
  using (
    (user_id = (select auth.uid()))
    or public.is_admin()
  );

-- Seed waitlist for existing profiles
insert into public.waitlist (user_id, email, status)
select p.id, coalesce(p.email, p.username || '@invis.app'), 'approved'
from public.profiles p
where p.status = 'active'
on conflict (user_id) do nothing;

-- 3) Recreate signup trigger: profile + waitlist
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uname text;
  dname text;
  prole text;
  pstatus text;
  wstatus text;
begin
  uname := lower(
    coalesce(
      nullif(new.raw_app_meta_data->>'username', ''),
      split_part(coalesce(new.email, new.id::text), '@', 1)
    )
  );
  if exists (select 1 from public.profiles where username = uname) then
    uname := uname || '_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  dname := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    split_part(coalesce(new.email, uname), '@', 1)
  );

  if coalesce(new.raw_app_meta_data->>'role', '') = 'admin' then
    prole := 'admin';
    pstatus := 'active';
    wstatus := 'approved';
  else
    prole := 'guest';
    pstatus := 'waitlist';
    wstatus := 'pending';
  end if;

  insert into public.profiles (id, username, display_name, email, role, status)
  values (new.id, uname, dname, new.email, prole, pstatus)
  on conflict (id) do nothing;

  if new.email is not null then
    insert into public.waitlist (user_id, email, status)
    values (new.id, lower(new.email), wstatus)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$function$;

-- Keep waitlist in sync when an admin flips profile.status in the dashboard
create or replace function public.sync_waitlist_from_profile_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status is distinct from old.status then
    update public.waitlist
    set
      status = case new.status
        when 'active' then 'approved'
        when 'rejected' then 'rejected'
        else 'pending'
      end,
      updated_at = now(),
      email = coalesce(lower(new.email), email)
    where user_id = new.id;

    if not found and new.email is not null then
      insert into public.waitlist (user_id, email, status)
      values (
        new.id,
        lower(new.email),
        case new.status
          when 'active' then 'approved'
          when 'rejected' then 'rejected'
          else 'pending'
        end
      )
      on conflict (user_id) do update
        set status = excluded.status,
            email = excluded.email,
            updated_at = now();
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists on_profile_status_sync_waitlist on public.profiles;
create trigger on_profile_status_sync_waitlist
  after update of status on public.profiles
  for each row
  execute function public.sync_waitlist_from_profile_status();
