-- 0005: Тадбир мавзуси (ихтиёрий)
alter table public.bookings
  add column if not exists event_topic text
  check (event_topic is null or char_length(event_topic) <= 300);

create or replace function public.save_booking(p jsonb, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_room public.rooms;
  v_starts timestamptz := (p ->> 'starts_at')::timestamptz;
  v_ends timestamptz := (p ->> 'ends_at')::timestamptz;
  v_mode public.time_mode := coalesce((p ->> 'time_mode')::public.time_mode, 'daily');
  v_skip boolean := coalesce((p ->> 'skip_weekends')::boolean, false);
  v_conflict record;
  v_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'Брон киритиш учун админ ҳуқуқи керак' using errcode = '42501';
  end if;

  select * into v_room from public.rooms where id = (p ->> 'room_id')::uuid;
  if not found or not v_room.is_active then
    raise exception 'Зал ёки хона топилмади ёки вақтинча ёпиқ' using errcode = 'P0001';
  end if;

  if p_id is not null then
    select created_by into v_owner from public.bookings where id = p_id for update;
    if not found then
      raise exception 'Брон топилмади' using errcode = 'P0001';
    end if;
    if v_owner is distinct from auth.uid() and not public.is_super_admin() then
      raise exception 'Фақат ўзингиз киритган бронни таҳрирлай оласиз' using errcode = '42501';
    end if;
  end if;

  -- Avval aniq xabar bilan tekshiramiz (exclusion constraint poyga holatini ham ushlaydi)
  select * into v_conflict
  from public.check_availability(v_room.id, v_starts, v_ends, v_mode, v_skip, p_id)
  limit 1;
  if found then
    raise exception 'CONFLICT'
      using errcode = 'P0002',
            detail = json_build_object(
              'booking_id', v_conflict.booking_id,
              'seq_no', v_conflict.seq_no,
              'organization', v_conflict.organization,
              'event_title', v_conflict.event_title,
              'slot_start', v_conflict.slot_start,
              'slot_end', v_conflict.slot_end
            )::text;
  end if;

  if p_id is null then
    insert into public.bookings (
      room_id, starts_at, ends_at, time_mode, skip_weekends,
      organization, event_title, event_topic, contact_name, contact_phone, note, attendees, color, created_by
    ) values (
      v_room.id, v_starts, v_ends, v_mode, v_skip,
      trim(p ->> 'organization'), trim(p ->> 'event_title'), nullif(trim(p ->> 'event_topic'), ''),
      nullif(trim(p ->> 'contact_name'), ''),
      nullif(p ->> 'contact_phone', ''), nullif(trim(p ->> 'note'), ''),
      nullif(p ->> 'attendees', '')::int, nullif(p ->> 'color', ''), auth.uid()
    ) returning id into v_id;
  else
    v_id := p_id;
    update public.bookings set
      room_id = v_room.id, starts_at = v_starts, ends_at = v_ends, time_mode = v_mode,
      skip_weekends = v_skip,
      organization = trim(p ->> 'organization'), event_title = trim(p ->> 'event_title'),
      event_topic = nullif(trim(p ->> 'event_topic'), ''),
      contact_name = nullif(trim(p ->> 'contact_name'), ''), contact_phone = nullif(p ->> 'contact_phone', ''),
      note = nullif(trim(p ->> 'note'), ''), attendees = nullif(p ->> 'attendees', '')::int,
      color = nullif(p ->> 'color', ''), status = 'confirmed', cancel_reason = null,
      updated_at = now()
    where id = v_id;
    delete from public.booking_slots where booking_id = v_id;
  end if;

  insert into public.booking_slots (booking_id, room_id, during)
  select v_id, v_room.id, c.during
  from public.compute_slots(v_starts, v_ends, v_mode, v_skip) c;

  if not found then
    raise exception 'Танланган оралиқда бирорта ҳам иш куни йўқ' using errcode = 'P0001';
  end if;

  insert into public.audit_log (actor, action, entity, entity_id, details)
  values (auth.uid(), case when p_id is null then 'create' else 'update' end, 'booking', v_id, p);

  return v_id;
exception
  when exclusion_violation then
    raise exception 'CONFLICT' using errcode = 'P0002', detail = '{}';
end $$;

-- Қайтариладиган устунлар ўзгаргани учун функцияни қайта яратамиз
drop function if exists public.get_bookings(timestamptz, timestamptz, boolean);
create or replace function public.get_bookings(
  p_from timestamptz,
  p_to timestamptz,
  p_include_cancelled boolean default false
)
returns table (
  id uuid, seq_no bigint, room_id uuid, room_name text,
  starts_at timestamptz, ends_at timestamptz, time_mode public.time_mode, skip_weekends boolean,
  organization text, event_title text, event_topic text, contact_name text, contact_phone text,
  note text, attendees int, color text, status public.booking_status, cancel_reason text,
  created_by uuid, created_by_email text, created_at timestamptz, updated_at timestamptz,
  slots jsonb, file_count int
)
language sql stable security definer set search_path = public
as $$
  select
    b.id, b.seq_no, b.room_id, r.name,
    b.starts_at, b.ends_at, b.time_mode, b.skip_weekends,
    b.organization, b.event_title, b.event_topic, b.contact_name,
    case when public.is_admin() then b.contact_phone else public.mask_phone(b.contact_phone) end,
    b.note, b.attendees, b.color, b.status, b.cancel_reason,
    b.created_by, cp.email, b.created_at, b.updated_at,
    coalesce((
      select jsonb_agg(jsonb_build_array(lower(s.during), upper(s.during)) order by lower(s.during))
      from public.booking_slots s where s.booking_id = b.id
    ), '[]'::jsonb),
    case when public.is_admin()
      then (select count(*)::int from public.booking_files f where f.booking_id = b.id)
      else 0 end
  from public.bookings b
  join public.rooms r on r.id = b.room_id
  left join public.profiles cp on cp.id = b.created_by
  where auth.uid() is not null
    and public.current_role() is not null
    and b.starts_at < p_to and b.ends_at > p_from
    and (p_include_cancelled or b.status = 'confirmed')
  order by b.starts_at, b.seq_no
$$;

grant execute on function public.get_bookings(timestamptz, timestamptz, boolean) to authenticated;
