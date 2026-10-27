-- Permanent user deletion — farm admin, own farm only (safe to run more than once)
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
