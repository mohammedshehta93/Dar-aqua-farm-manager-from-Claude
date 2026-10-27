-- Error logging — farms can only WRITE errors; only the platform owner can READ them (safe to run more than once)
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  farm_id uuid references public.farms(id) on delete cascade,
  user_id uuid default auth.uid(),
  user_email text, role text, view text, kind text,
  message text, source text, line int, col int, stack text,
  user_agent text, app_version text, fingerprint text,
  resolved boolean not null default false
);
alter table public.client_errors enable row level security;
create index if not exists client_errors_fp on public.client_errors(fingerprint, created_at desc);

drop policy if exists errors_insert on public.client_errors;
create policy errors_insert on public.client_errors for insert to authenticated
  with check (user_id = auth.uid() and (farm_id is null or farm_id = public.my_farm())
              and length(coalesce(message,'')) <= 1000 and length(coalesce(stack,'')) <= 4000);
-- no select/update/delete policies: reading happens only through the platform functions below

create or replace function public.platform_list_errors(p_days int default 14, p_include_resolved boolean default false)
returns table(fingerprint text, message text, kind text, view text, source text, line int, occurrences bigint, users bigint,
              farms text, first_seen timestamptz, last_seen timestamptz, last_stack text, last_agent text, app_version text, resolved boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  return query
  select e.fingerprint, max(e.message), max(e.kind), max(e.view), max(e.source), max(e.line),
         count(*), count(distinct e.user_id), string_agg(distinct coalesce(f.name, '—'), ', '),
         min(e.created_at), max(e.created_at),
         (array_agg(e.stack order by e.created_at desc))[1],
         (array_agg(e.user_agent order by e.created_at desc))[1],
         (array_agg(e.app_version order by e.created_at desc))[1],
         bool_and(e.resolved)
  from public.client_errors e left join public.farms f on f.id = e.farm_id
  where e.created_at > now() - make_interval(days => p_days) and (p_include_resolved or not e.resolved)
  group by e.fingerprint order by max(e.created_at) desc limit 200;
end $$;

create or replace function public.platform_resolve_error(p_fingerprint text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  update public.client_errors set resolved = true where fingerprint = p_fingerprint;
end $$;

-- keep the table small: remove entries older than 90 days (call from the platform page)
create or replace function public.platform_prune_errors() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  delete from public.client_errors where created_at < now() - interval '90 days';
  get diagnostics n = row_count; return n;
end $$;

revoke execute on function public.platform_list_errors(int, boolean), public.platform_resolve_error(text), public.platform_prune_errors() from anon, public;
grant execute on function public.platform_list_errors(int, boolean), public.platform_resolve_error(text), public.platform_prune_errors() to authenticated;
