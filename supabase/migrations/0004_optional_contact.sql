-- 0004: Ф.И.Ш. ва телефон мажбурий эмас
alter table public.bookings
  alter column contact_name drop not null,
  alter column contact_phone drop not null;

alter table public.bookings drop constraint if exists bookings_contact_name_check;
alter table public.bookings drop constraint if exists bookings_contact_phone_check;
alter table public.bookings
  add constraint bookings_contact_name_check check (contact_name is null or char_length(contact_name) between 1 and 120),
  add constraint bookings_contact_phone_check check (contact_phone is null or contact_phone ~ '^\+998\d{9}$');

create or replace function public.mask_phone(p text)
returns text language sql immutable
as $$
  select case when p is null then null
    when p ~ '^\+998\d{9}$' then '+998 ' || substr(p, 5, 2) || ' *** ** ' || substr(p, 12, 2)
    else '***' end
$$;

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
      organization, event_title, contact_name, contact_phone, note, attendees, color, created_by
    ) values (
      v_room.id, v_starts, v_ends, v_mode, v_skip,
      trim(p ->> 'organization'), trim(p ->> 'event_title'), nullif(trim(p ->> 'contact_name'), ''),
      nullif(p ->> 'contact_phone', ''), nullif(trim(p ->> 'note'), ''),
      nullif(p ->> 'attendees', '')::int, nullif(p ->> 'color', ''), auth.uid()
    ) returning id into v_id;
  else
    v_id := p_id;
    update public.bookings set
      room_id = v_room.id, starts_at = v_starts, ends_at = v_ends, time_mode = v_mode,
      skip_weekends = v_skip,
      organization = trim(p ->> 'organization'), event_title = trim(p ->> 'event_title'),
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
