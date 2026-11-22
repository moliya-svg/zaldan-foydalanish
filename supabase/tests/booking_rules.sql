-- Lokal sinov: psql -v ON_ERROR_STOP=1 -f local_stub.sql -f ../migrations/0001_schema.sql -f ../migrations/0003_seed_rooms.sql -f booking_rules.sql
\set QUIET on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'ILXOMOVB2023@gmail.com'),
  ('00000000-0000-0000-0000-000000000003', 'viewer@example.uz');
insert into public.role_grants (email, role) values ('admin@example.uz', 'admin');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000002', 'admin@example.uz');

select email, role from public.profiles order by email;

create or replace function pg_temp.expect_error(sql text, code text) returns text language plpgsql as $$
begin
  execute sql;
  return 'FAIL: no error for ' || sql;
exception when others then
  if sqlstate = code then return 'ok ' || code || ' ' || sqlerrm; end if;
  return 'FAIL: got ' || sqlstate || ' ' || sqlerrm;
end $$;

-- 1) Admin daily booking 24–26 Nov 09:00–13:00 in Katta zal
set role authenticated;
set test.uid = '00000000-0000-0000-0000-000000000002';
select public.save_booking(jsonb_build_object(
  'room_id', (select id from public.rooms where name = 'Катта мажлислар зали'),
  'starts_at', '2026-11-24T09:00:00+05:00', 'ends_at', '2026-11-26T13:00:00+05:00',
  'time_mode', 'daily', 'organization', 'Молия академияси', 'event_title', 'Семинар',
  'contact_name', 'Каримов Акмал', 'contact_phone', '+998901234567')) is not null as created_daily;
select count(*) as slots_expected_3 from public.booking_slots;

-- 2) Same room, afternoon on 25 Nov → allowed (daily mode leaves afternoons free)
select public.save_booking(jsonb_build_object(
  'room_id', (select id from public.rooms where name = 'Катта мажлислар зали'),
  'starts_at', '2026-11-25T14:00:00+05:00', 'ends_at', '2026-11-25T17:00:00+05:00',
  'time_mode', 'continuous', 'organization', 'Вазирлик', 'event_title', 'Мажлис',
  'contact_name', 'Тошматов Бахтиёр', 'contact_phone', '+998935556677')) is not null as afternoon_ok;

-- 3) Overlap 25 Nov 12:00–15:00 → conflict P0002
select pg_temp.expect_error($q$ select public.save_booking(jsonb_build_object(
  'room_id', (select id from public.rooms where name = 'Катта мажлислар зали'),
  'starts_at', '2026-11-25T12:00:00+05:00', 'ends_at', '2026-11-25T15:00:00+05:00',
  'time_mode', 'continuous', 'organization', 'X ташкилот', 'event_title', 'Тренинг',
  'contact_name', 'Али Валиев', 'contact_phone', '+998901112233')) $q$, 'P0002') as overlap_rejected;

-- 4) Same time, different room → allowed
select public.save_booking(jsonb_build_object(
  'room_id', (select id from public.rooms where name = '207-хона'),
  'starts_at', '2026-11-25T12:00:00+05:00', 'ends_at', '2026-11-25T15:00:00+05:00',
  'time_mode', 'continuous', 'organization', 'X ташкилот', 'event_title', 'Тренинг',
  'contact_name', 'Али Валиев', 'contact_phone', '+998901112233')) is not null as other_room_ok;

-- 5) Skip weekends: Fri 27 → Mon 30 Nov gives 2 slots
select count(*) as weekend_skip_expected_2 from public.compute_slots(
  '2026-11-27T10:00:00+05:00', '2026-11-30T12:00:00+05:00', 'daily', true);

-- 6) Raw insert bypassing function → permission denied
select pg_temp.expect_error($q$ insert into public.booking_slots (booking_id, room_id, during)
  select id, room_id, tstzrange(now(), now() + interval '1 hour') from public.bookings limit 1 $q$, '42501') as raw_insert_blocked;

-- 7) Viewer: cannot book, sees masked phone
set test.uid = '00000000-0000-0000-0000-000000000003';
select pg_temp.expect_error($q$ select public.save_booking(jsonb_build_object(
  'room_id', (select id from public.rooms limit 1),
  'starts_at', '2026-12-01T09:00:00+05:00', 'ends_at', '2026-12-01T10:00:00+05:00',
  'time_mode', 'continuous', 'organization', 'Ташкилот', 'event_title', 'Тест',
  'contact_name', 'Тест Тестов', 'contact_phone', '+998901234567')) $q$, '42501') as viewer_blocked;
select seq_no, contact_phone, jsonb_array_length(slots) as n_slots from public.get_bookings('2026-11-01', '2026-12-01') order by seq_no;
select count(*) as viewer_direct_select_0 from public.bookings;

-- 8) Admin cannot promote; super admin can; super admin cannot be demoted
set test.uid = '00000000-0000-0000-0000-000000000002';
select pg_temp.expect_error($q$ select public.set_user_role('viewer@example.uz', 'admin') $q$, '42501') as admin_cannot_grant;
set test.uid = '00000000-0000-0000-0000-000000000001';
select public.set_user_role('viewer@example.uz', 'admin');
select pg_temp.expect_error($q$ select public.set_user_role('ilxomovb2023@gmail.com', 'viewer') $q$, 'P0001') as super_admin_protected;
reset role;
select email, role from public.profiles order by email;

-- 9) Cancel frees the slot
set role authenticated;
set test.uid = '00000000-0000-0000-0000-000000000001';
select public.cancel_booking((select id from public.bookings where seq_no = 1), 'Кўчирилди');
select count(*) as free_after_cancel_0 from public.check_availability(
  (select id from public.rooms where name = 'Катта мажлислар зали'),
  '2026-11-25T09:00:00+05:00', '2026-11-25T10:00:00+05:00', 'continuous');
