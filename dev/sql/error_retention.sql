-- Error reports are deleted after 90 days automatically (privacy page promise). Safe to run more than once.
-- Runs once per insert statement; cheap thanks to the created_at index.
create index if not exists client_errors_created on public.client_errors(created_at);

create or replace function public.client_errors_prune() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.client_errors where created_at < now() - interval '90 days';
  return null;
end $$;

drop trigger if exists client_errors_prune on public.client_errors;
create trigger client_errors_prune after insert on public.client_errors
  for each statement execute function public.client_errors_prune();

revoke execute on function public.client_errors_prune() from anon, public;
