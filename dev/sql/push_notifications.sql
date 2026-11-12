-- Phone notifications (work orders, routine reminders) — run once in Supabase → SQL Editor.
-- One row per phone that turned notifications on. Each user writes only their own rows; the farm-push Worker reads
-- them with the service key to send.
create table if not exists public.push_subs (
  id         text primary key,                       -- hash of the phone's push endpoint
  farm_id    uuid not null references public.farms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text,
  sites      text[],                                 -- the sites this user works on (null = all)
  lang       text default 'ar',
  endpoint   text not null,
  updated_at timestamptz default now()
);
alter table public.push_subs enable row level security;
drop policy if exists push_own_read   on public.push_subs;
drop policy if exists push_own_insert on public.push_subs;
drop policy if exists push_own_update on public.push_subs;
drop policy if exists push_own_delete on public.push_subs;
create policy push_own_read   on public.push_subs for select to authenticated using (user_id = auth.uid());
create policy push_own_insert on public.push_subs for insert to authenticated with check (user_id = auth.uid() and farm_id = public.my_farm());
create policy push_own_update on public.push_subs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and farm_id = public.my_farm());
create policy push_own_delete on public.push_subs for delete to authenticated using (user_id = auth.uid());
create index if not exists push_subs_farm on public.push_subs (farm_id);
