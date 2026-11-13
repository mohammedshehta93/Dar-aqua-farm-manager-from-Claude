-- Maintenance inside Farm Manager — run once in Supabase → SQL Editor.
-- Uses the SAME table and photo bucket as the old standalone maintenance tool, so every old request stays, and the old
-- tool keeps working during the move (its "anon" access is kept until it is closed).

-- Creates the table and the photo bucket if they are not there yet (an existing table and its requests are left as they are).
create table if not exists public.maintenance_requests (
  id                uuid primary key default gen_random_uuid(),
  ref               text,
  requested_by      text,
  area              text,
  summary           text,
  details           text,
  priority          text default 'medium',
  type              text default 'corrective',
  status            text default 'open',
  target_date       date,
  root_cause        text default '',
  corrective_action text default '',
  parts             text default '',
  technician        text default '',
  verified_by       text default '',
  photo_urls        text[] default '{}',
  created_at        timestamptz default now(),
  closed_at         timestamptz
);
insert into storage.buckets (id, name, public) values ('maintenance-images', 'maintenance-images', true) on conflict (id) do nothing;

alter table public.maintenance_requests add column if not exists farm_id uuid references public.farms(id) on delete cascade;
alter table public.maintenance_requests add column if not exists site text;
alter table public.maintenance_requests add column if not exists reported_by_uid uuid;
alter table public.maintenance_requests add column if not exists purchase_refs text[];

alter table public.maintenance_requests enable row level security;
-- the old standalone tool (no login) — remove this one policy when it is closed
drop policy if exists maint_legacy_anon on public.maintenance_requests;
create policy maint_legacy_anon on public.maintenance_requests for all to anon using (true) with check (true);
-- signed-in users of the farm (rows from the old tool have no farm yet: the app gives them this farm on first open)
drop policy if exists maint_read   on public.maintenance_requests;
drop policy if exists maint_insert on public.maintenance_requests;
drop policy if exists maint_update on public.maintenance_requests;
drop policy if exists maint_delete on public.maintenance_requests;
create policy maint_read   on public.maintenance_requests for select to authenticated using (farm_id = public.my_farm() or farm_id is null);
create policy maint_insert on public.maintenance_requests for insert to authenticated with check (farm_id = public.my_farm());
create policy maint_update on public.maintenance_requests for update to authenticated using (farm_id = public.my_farm() or farm_id is null) with check (farm_id = public.my_farm());
create policy maint_delete on public.maintenance_requests for delete to authenticated using (farm_id = public.my_farm());

-- photos: signed-in users may upload to the same bucket; everyone may view (as before)
drop policy if exists maint_img_auth_insert on storage.objects;
create policy maint_img_auth_insert on storage.objects for insert to authenticated with check (bucket_id = 'maintenance-images');
drop policy if exists maint_img_read on storage.objects;
create policy maint_img_read on storage.objects for select using (bucket_id = 'maintenance-images');
