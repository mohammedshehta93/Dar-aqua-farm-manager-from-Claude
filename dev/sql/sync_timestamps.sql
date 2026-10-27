-- Server-stamped change time: lets every device download only what changed (safe to run more than once)
alter table public.transactions add column if not exists synced_at timestamptz not null default now();
create index if not exists tx_farm_synced on public.transactions(farm_id, synced_at);

create or replace function public.touch_synced_at() returns trigger language plpgsql as $$
begin new.synced_at := now(); return new; end $$;

drop trigger if exists tx_synced_at on public.transactions;
create trigger tx_synced_at before insert or update on public.transactions
  for each row execute function public.touch_synced_at();
