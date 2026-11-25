-- Archives ("start fresh, keep the old") — run once in Supabase → SQL Editor.
-- A PRIVATE storage bucket: each farm's admin reads and writes only his farm's folder (<farm_id>/...).
insert into storage.buckets (id, name, public) values ('farm-archives', 'farm-archives', false) on conflict (id) do nothing;
drop policy if exists farm_archives_rw on storage.objects;
create policy farm_archives_rw on storage.objects for all to authenticated
  using (bucket_id = 'farm-archives' and (storage.foldername(name))[1] = public.my_farm()::text and public.my_role() = 'admin')
  with check (bucket_id = 'farm-archives' and (storage.foldername(name))[1] = public.my_farm()::text and public.my_role() = 'admin');
