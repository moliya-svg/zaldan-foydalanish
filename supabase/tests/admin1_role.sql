-- Lokal sinov: local_stub.sql + 0001, 0003–0007 migratsiyalardan keyin
\set QUIET on
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'ilxomovb2023@gmail.com');
select public.set_user_role('a@example.uz', 'admin') from (select set_config('test.uid', '00000000-0000-0000-0000-000000000001', false)) s;
select public.set_user_role('b@example.uz', 'admin');
select public.set_user_role('one@example.uz', 'admin1');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.uz'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.uz'),
  ('00000000-0000-0000-0000-0000000000a1', 'one@example.uz');
select email, role from public.profiles order by email;

create or replace function pg_temp.expect_error(sql text, code text) returns text language plpgsql as $$
begin
  execute sql;
  return 'FAIL: no error for ' || sql;
exception when others then
  if sqlstate = code then return 'ok ' || code; end if;
  return 'FAIL: got ' || sqlstate || ' ' || sqlerrm;
end $$;

set role authenticated;
-- A (admin) creates two bookings
set test.uid = '00000000-0000-0000-0000-00000000000a';
select public.save_booking(jsonb_build_object(
  'room_id', (select id from public.rooms where name = '207-хона'),
  'starts_at', '2026-12-01T09:00:00+05:00', 'ends_at', '2026-12-01T11:00:00+05:00',
  'time_mode', 'continuous', 'organization', 'Ташкилот А', 'event_title', 'Тадбир A1')) is not null as a_created;
select public.save_booking(jsonb_build_object(
  'room_id', (select id from public.rooms where name = '207-хона'),
  'starts_at', '2026-12-02T09:00:00+05:00', 'ends_at', '2026-12-02T11:00:00+05:00',
  'time_mode', 'continuous', 'organization', 'Ташкилот А', 'event_title', 'Тадбир A2')) is not null as a_created2;

-- B (oddiy admin): A bronini tahrirlay/o'chira olmaydi
set test.uid = '00000000-0000-0000-0000-00000000000b';
select pg_temp.expect_error(format($q$ select public.save_booking(jsonb_build_object(
  'room_id', (select id from public.rooms where name = '207-хона'),
  'starts_at', '2026-12-01T09:00:00+05:00', 'ends_at', '2026-12-01T10:00:00+05:00',
  'time_mode', 'continuous', 'organization', 'Ташкилот Б', 'event_title', 'Тадбир x'), %L::uuid) $q$,
  (select id from public.bookings where event_title = 'Тадбир A1')), '42501') as admin_cannot_edit_others;
select pg_temp.expect_error(format('select public.delete_booking(%L::uuid)', (select id from public.bookings where event_title = 'Тадбир A1')), '42501') as admin_cannot_delete;

-- Admin-1: tahrirlaydi, bekor qiladi, o'chiradi
set test.uid = '00000000-0000-0000-0000-0000000000a1';
select public.is_admin() as admin1_is_admin, public.can_manage_all_bookings() as admin1_manages_all;
select public.save_booking(jsonb_build_object(
  'room_id', (select id from public.rooms where name = '207-хона'),
  'starts_at', '2026-12-01T09:00:00+05:00', 'ends_at', '2026-12-01T10:00:00+05:00',
  'time_mode', 'continuous', 'organization', 'Ташкилот А', 'event_title', 'A1 таҳрир'),
  (select id from public.bookings where event_title = 'Тадбир A1')) is not null as admin1_edited;
select public.cancel_booking((select id from public.bookings where event_title = 'Тадбир A2'), 'test');
select public.delete_booking((select id from public.bookings where event_title = 'A1 таҳрир'));
select count(*) as remaining_expected_1 from public.bookings;
-- Admin-1 Boshqaruvga kira olmaydi
select pg_temp.expect_error($q$ select public.set_user_role('z@example.uz', 'admin') $q$, '42501') as admin1_no_user_mgmt;
reset role;
