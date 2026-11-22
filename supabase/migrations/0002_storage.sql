-- PDF va JPEG fayllar uchun yopiq (private) bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-files', 'booking-files', false, 10485760, array['application/pdf', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "booking files read" on storage.objects;
create policy "booking files read" on storage.objects for select to authenticated
  using (bucket_id = 'booking-files' and public.is_admin());

drop policy if exists "booking files upload" on storage.objects;
create policy "booking files upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'booking-files'
    and public.is_admin()
    and (storage.foldername(name))[1] = 'bookings'
  );

drop policy if exists "booking files delete" on storage.objects;
create policy "booking files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'booking-files' and public.is_admin());
