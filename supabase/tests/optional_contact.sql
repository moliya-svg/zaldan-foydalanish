-- Lokal sinov (booking_rules.sql dan keyin, «reset role;» bilan): ... -f ../migrations/0004_optional_contact.sql -f optional_contact.sql
set role authenticated;
set test.uid = '00000000-0000-0000-0000-000000000002';
select public.save_booking(jsonb_build_object(
  'room_id', (select id from public.rooms where name = 'Катта мажлислар зали'),
  'starts_at', '2026-12-01T09:00:00+05:00', 'ends_at', '2026-12-01T12:00:00+05:00',
  'time_mode', 'continuous', 'organization', 'Вазирлик', 'event_title', 'ФИШсиз',
  'contact_name', '', 'contact_phone', '')) is not null as created_without_contact;
select contact_name is null as name_null, contact_phone is null as phone_null from public.bookings where event_title = 'ФИШсиз';
set test.uid = '00000000-0000-0000-0000-000000000003';
select contact_phone is null as viewer_sees_null from public.get_bookings('2026-12-01','2026-12-31', false) where event_title = 'ФИШсиз';
reset role;
