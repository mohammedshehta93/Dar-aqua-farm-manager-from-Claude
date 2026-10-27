-- ═══════════════════════════════════════════════════════════
--  Farm Manager — multi-farm setup (safe to run more than once)
-- ═══════════════════════════════════════════════════════════

-- 1) Farm licence fields
alter table public.farms add column if not exists active boolean not null default true;
alter table public.farms add column if not exists max_users int not null default 10;
alter table public.farms add column if not exists expires_at date;
alter table public.farms add column if not exists created_by uuid;

-- 2) Per-farm units, per-farm settings, platform owners
create table if not exists public.farm_units (
  id text primary key,
  farm_id uuid not null references public.farms(id) on delete cascade,
  unit text not null,
  data jsonb not null,
  ts timestamptz default now()
);
create table if not exists public.farm_settings (
  farm_id uuid primary key references public.farms(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  ts timestamptz default now()
);
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.farm_units enable row level security;
alter table public.farm_settings enable row level security;
alter table public.platform_admins enable row level security;

-- 3) Access helpers — a suspended or expired farm loses access on the server
create or replace function public.my_farm() returns uuid language sql stable security definer set search_path = public as $$
  select p.farm_id from public.profiles p join public.farms f on f.id = p.farm_id
  where p.id = auth.uid() and p.active and f.active and (f.expires_at is null or f.expires_at >= current_date) $$;
create or replace function public.my_role() returns text language sql stable security definer set search_path = public as $$
  select p.role from public.profiles p join public.farms f on f.id = p.farm_id
  where p.id = auth.uid() and p.active and f.active and (f.expires_at is null or f.expires_at >= current_date) $$;
create or replace function public.can_write() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin','manager','engineer','worker'), false) $$;
create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.platform_admins where user_id = auth.uid()) $$;
create or replace function public.am_platform_admin() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() $$;
create or replace function public.farm_user_count(f uuid) returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.profiles where farm_id = f $$;
create or replace function public.farm_max_users(f uuid) returns int language sql stable security definer set search_path = public as $$
  select max_users from public.farms where id = f $$;

-- 4) Farm admin actions
create or replace function public.wipe_my_farm_data() returns void language plpgsql security definer set search_path = public as $$
declare f uuid := public.my_farm();
begin
  if f is null or public.my_role() <> 'admin' then raise exception 'not allowed'; end if;
  delete from public.transactions   where farm_id = f;
  delete from public.snapshots      where farm_id = f;
  delete from public.feed_inventory where farm_id = f;
  delete from public.farm_units     where farm_id = f;
  delete from public.farm_settings  where farm_id = f;
end $$;
create or replace function public.update_my_farm(p_name text, p_location text) returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() <> 'admin' then raise exception 'not allowed'; end if;
  update public.farms set name = coalesce(nullif(p_name,''), name), location = p_location where id = public.my_farm();
end $$;

-- 5) Platform owner actions (licence management only — no access to farm data)
create or replace function public.platform_list_farms()
returns table(id uuid, name text, location text, active boolean, max_users int, expires_at date, created_at timestamptz,
              users bigint, admin_email text, tx_count bigint, last_activity timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  return query
  select f.id, f.name, f.location, f.active, f.max_users, f.expires_at, f.created_at,
         (select count(*) from public.profiles p where p.farm_id = f.id),
         (select p.email from public.profiles p where p.farm_id = f.id and p.role = 'admin' order by p.created_at limit 1),
         (select count(*) from public.transactions t where t.farm_id = f.id),
         (select max(t.ts) from public.transactions t where t.farm_id = f.id)
  from public.farms f order by f.created_at;
end $$;
create or replace function public.platform_create_farm(p_name text, p_location text, p_species text, p_admin_id uuid,
  p_admin_email text, p_admin_name text, p_max_users int, p_expires date) returns uuid
language plpgsql security definer set search_path = public as $$
declare f uuid;
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  if not exists(select 1 from auth.users where id = p_admin_id) then raise exception 'admin account not found'; end if;
  if exists(select 1 from public.profiles where id = p_admin_id) then raise exception 'this account already belongs to a farm'; end if;
  insert into public.farms(name, location, species, owner_id, created_by, max_users, expires_at, active)
    values (p_name, p_location, coalesce(nullif(p_species,''), 'Silver Tilapia'), p_admin_id::text, auth.uid(), coalesce(p_max_users, 10), p_expires, true)
    returning id into f;
  insert into public.profiles(id, email, name, role, perms, farm_id, active)
    values (p_admin_id, lower(p_admin_email), p_admin_name, 'admin', '[]'::jsonb, f, true);
  return f;
end $$;
create or replace function public.platform_update_farm(p_id uuid, p_active boolean, p_max_users int, p_expires date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  update public.farms set active = coalesce(p_active, active), max_users = coalesce(p_max_users, max_users), expires_at = p_expires where id = p_id;
end $$;

revoke execute on function public.my_farm(), public.my_role(), public.can_write(), public.is_platform_admin(), public.am_platform_admin(),
  public.farm_user_count(uuid), public.farm_max_users(uuid), public.wipe_my_farm_data(), public.update_my_farm(text,text),
  public.platform_list_farms(), public.platform_create_farm(text,text,text,uuid,text,text,int,date),
  public.platform_update_farm(uuid,boolean,int,date) from anon, public;
grant execute on function public.my_farm(), public.my_role(), public.can_write(), public.is_platform_admin(), public.am_platform_admin(),
  public.farm_user_count(uuid), public.farm_max_users(uuid), public.wipe_my_farm_data(), public.update_my_farm(text,text),
  public.platform_list_farms(), public.platform_create_farm(text,text,text,uuid,text,text,int,date),
  public.platform_update_farm(uuid,boolean,int,date) to authenticated;

-- 6) You are the platform owner
insert into public.platform_admins(user_id) select id from auth.users where email = '<PLATFORM_OWNER_EMAIL>' on conflict do nothing;

-- 7) Replace ALL policies — every rule is scoped to the caller's own farm
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('farms','transactions','snapshots','feed_inventory','profiles','farm_units','farm_settings','platform_admins')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

create policy profiles_read   on public.profiles for select to authenticated using (id = auth.uid() or farm_id = public.my_farm());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.my_role() = 'admin' and farm_id = public.my_farm()
              and public.farm_user_count(public.my_farm()) < public.farm_max_users(public.my_farm()));
create policy profiles_update on public.profiles for update to authenticated
  using (public.my_role() = 'admin' and farm_id = public.my_farm()) with check (farm_id = public.my_farm());

create policy farms_read on public.farms for select to authenticated using (id = public.my_farm());

create policy units_read  on public.farm_units for select to authenticated using (farm_id = public.my_farm());
create policy units_write on public.farm_units for all to authenticated
  using (farm_id = public.my_farm() and public.my_role() in ('admin','manager','engineer'))
  with check (farm_id = public.my_farm() and public.my_role() in ('admin','manager','engineer'));

create policy settings_read   on public.farm_settings for select to authenticated using (farm_id = public.my_farm());
create policy settings_insert on public.farm_settings for insert to authenticated with check (farm_id = public.my_farm() and public.can_write());
create policy settings_update on public.farm_settings for update to authenticated
  using (farm_id = public.my_farm() and public.can_write()) with check (farm_id = public.my_farm());

create policy tx_read   on public.transactions for select to authenticated using (farm_id = public.my_farm());
create policy tx_insert on public.transactions for insert to authenticated with check (farm_id = public.my_farm() and public.can_write());
create policy tx_update on public.transactions for update to authenticated using (farm_id = public.my_farm() and public.can_write()) with check (farm_id = public.my_farm());
create policy tx_delete on public.transactions for delete to authenticated using (farm_id = public.my_farm() and public.my_role() in ('admin','manager','engineer'));

create policy snap_read   on public.snapshots for select to authenticated using (farm_id = public.my_farm());
create policy snap_insert on public.snapshots for insert to authenticated with check (farm_id = public.my_farm() and public.can_write());
create policy snap_update on public.snapshots for update to authenticated using (farm_id = public.my_farm() and public.can_write()) with check (farm_id = public.my_farm());

create policy inv_read   on public.feed_inventory for select to authenticated using (farm_id = public.my_farm());
create policy inv_insert on public.feed_inventory for insert to authenticated with check (farm_id = public.my_farm() and public.can_write());
create policy inv_update on public.feed_inventory for update to authenticated using (farm_id = public.my_farm() and public.can_write()) with check (farm_id = public.my_farm());
create policy inv_delete on public.feed_inventory for delete to authenticated using (farm_id = public.my_farm() and public.my_role() in ('admin','manager','engineer'));

-- 8) Result: your farm + platform owner flag
select f.name as farm, p.email, p.role, (pa.user_id is not null) as platform_owner
from public.profiles p join public.farms f on f.id = p.farm_id
left join public.platform_admins pa on pa.user_id = p.id order by p.created_at;
create or replace function public.delete_farm_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare f uuid := public.my_farm();
begin
  if f is null or public.my_role() <> 'admin' then raise exception 'not allowed'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot delete yourself'; end if;
  if not exists(select 1 from public.profiles where id = p_user_id and farm_id = f) then raise exception 'user is not in your farm'; end if;
  if exists(select 1 from public.platform_admins where user_id = p_user_id) then raise exception 'cannot delete the platform owner'; end if;
  delete from auth.users where id = p_user_id;   -- profile is removed automatically (on delete cascade)
end $$;
revoke execute on function public.delete_farm_user(uuid) from anon, public;
grant execute on function public.delete_farm_user(uuid) to authenticated;
