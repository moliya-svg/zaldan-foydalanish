-- Барча созламалар битта файлда: Supabase → SQL Editor → New query → шу матнни тўлиқ қўйинг → Run

-- ===== supabase/migrations/0001_schema.sql =====
-- 26 ZAL: zal va xonalarni bronlash tizimi — asosiy sxema
-- Supabase SQL Editor'da bir marta ishga tushiriladi (yoki `supabase db push`).

create extension if not exists btree_gist;

-- ─────────────────────────────── Turlar ───────────────────────────────
do $$ begin
  create type public.user_role as enum ('super_admin', 'admin', 'viewer');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.booking_status as enum ('confirmed', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.time_mode as enum ('continuous', 'daily');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────── Jadvallar ─────────────────────────────
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);
insert into public.app_settings (key, value)
values ('super_admin_email', 'ilxomovb2023@gmail.com')
on conflict (key) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text unique not null,
  full_name text,
  role public.user_role not null default 'viewer',
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Hali tizimga kirmagan e-mail'ga oldindan rol berish
create table if not exists public.role_grants (
  email text primary key,
  role public.user_role not null,
  granted_by uuid references public.profiles,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('hall', 'classroom', 'computer')),
  floor int,
  capacity int not null check (capacity > 0),
  capacity_alt text,
  amenities text[] not null default '{}',
  photo_url text,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  seq_no bigint generated always as identity,
  room_id uuid not null references public.rooms,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_mode public.time_mode not null default 'daily',
  skip_weekends boolean not null default false,
  organization text not null check (char_length(organization) between 2 and 200),
  event_title text not null check (char_length(event_title) between 2 and 200),
  contact_name text not null check (char_length(contact_name) between 3 and 120),
  contact_phone text not null check (contact_phone ~ '^\+998\d{9}$'),
  note text check (note is null or char_length(note) <= 1000),
  attendees int check (attendees is null or attendees > 0),
  color text,
  status public.booking_status not null default 'confirmed',
  cancel_reason text,
  created_by uuid references public.profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists bookings_range_idx on public.bookings (starts_at, ends_at);

-- Bronning haqiqiy band oraliqlari ('daily' rejimida har kun alohida)
create table if not exists public.booking_slots (
  id bigserial primary key,
  booking_id uuid not null references public.bookings on delete cascade,
  room_id uuid not null references public.rooms,
  during tstzrange not null,
  active boolean not null default true,
  -- Bir xonani bir vaqtga ikki marta band qilish baza darajasida taqiqlanadi
  constraint booking_slots_no_overlap
    exclude using gist (room_id with =, during with &&) where (active)
);
create index if not exists booking_slots_during_idx on public.booking_slots using gist (during);
create index if not exists booking_slots_booking_idx on public.booking_slots (booking_id);

create table if not exists public.booking_files (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings on delete cascade,
  kind text not null check (kind in ('pdf', 'jpeg')),
  path text not null unique,
  original_name text,
  size_bytes int,
  uploaded_by uuid references public.profiles,
  created_at timestamptz not null default now()
);
create index if not exists booking_files_booking_idx on public.booking_files (booking_id);

create table if not exists public.audit_log (
  id bigserial primary key,
  actor uuid references public.profiles,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────── Yordamchi funksiyalar ──────────────────
create or replace function public.current_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select case when p.is_blocked then null else p.role end
  from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_role() in ('admin', 'super_admin'), false)
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_role() = 'super_admin', false)
$$;

-- Yangi foydalanuvchi → profil (bosh admin e-mail'i doim super_admin)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(new.email);
  v_role public.user_role := 'viewer';
begin
  if v_email = (select lower(value) from public.app_settings where key = 'super_admin_email') then
    v_role := 'super_admin';
  else
    select g.role into v_role from public.role_grants g where g.email = v_email;
    v_role := coalesce(v_role, 'viewer');
  end if;
  insert into public.profiles (id, email, full_name, role)
  values (new.id, v_email, new.raw_user_meta_data ->> 'full_name', v_role)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bosh admin rolini hech kim o'zgartira yoki bloklay olmaydi
create or replace function public.protect_super_admin()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if lower(old.email) = (select lower(value) from public.app_settings where key = 'super_admin_email') then
    new.role := 'super_admin';
    new.is_blocked := false;
  elsif new.role = 'super_admin' then
    raise exception 'Бош админ фақат битта бўлади' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_super_admin on public.profiles;
create trigger profiles_protect_super_admin
  before update on public.profiles
  for each row execute function public.protect_super_admin();

-- ─────────────────────────────── Slotlarni hisoblash ────────────────────
-- Toshkent vaqti (UTC+5, yozgi vaqt yo'q) bo'yicha.
create or replace function public.compute_slots(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_mode public.time_mode,
  p_skip_weekends boolean
)
returns table (during tstzrange)
language plpgsql stable
as $$
declare
  v_tz constant text := 'Asia/Tashkent';
  v_start_local timestamp := p_starts_at at time zone v_tz;
  v_end_local timestamp := p_ends_at at time zone v_tz;
  v_day date;
begin
  if p_ends_at <= p_starts_at then
    raise exception 'Тугаш вақти бошланишдан кейин бўлиши керак' using errcode = 'P0001';
  end if;

  if p_mode = 'continuous' then
    during := tstzrange(p_starts_at, p_ends_at, '[)');
    return next;
    return;
  end if;

  if v_end_local::time <= v_start_local::time then
    raise exception '«Ҳар куни» режимида тугаш соати бошланиш соатидан кейин бўлиши керак' using errcode = 'P0001';
  end if;

  v_day := v_start_local::date;
  while v_day <= v_end_local::date loop
    if not (p_skip_weekends and extract(isodow from v_day) in (6, 7)) then
      during := tstzrange(
        (v_day + v_start_local::time) at time zone v_tz,
        (v_day + v_end_local::time) at time zone v_tz,
        '[)'
      );
      return next;
    end if;
    v_day := v_day + 1;
  end loop;
end $$;

-- ─────────────────────────────── Bandlikni tekshirish ───────────────────
create or replace function public.check_availability(
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_mode public.time_mode,
  p_skip_weekends boolean default false,
  p_exclude_booking uuid default null
)
returns table (
  booking_id uuid,
  seq_no bigint,
  organization text,
  event_title text,
  starts_at timestamptz,
  ends_at timestamptz,
  slot_start timestamptz,
  slot_end timestamptz
)
language sql stable security definer set search_path = public
as $$
  select distinct on (b.id)
    b.id, b.seq_no, b.organization, b.event_title, b.starts_at, b.ends_at,
    lower(s.during), upper(s.during)
  from public.compute_slots(p_starts_at, p_ends_at, p_mode, p_skip_weekends) c
  join public.booking_slots s
    on s.room_id = p_room_id and s.active and s.during && c.during
  join public.bookings b on b.id = s.booking_id
  where auth.uid() is not null
    and (p_exclude_booking is null or b.id <> p_exclude_booking)
  order by b.id, lower(s.during)
$$;

-- Berilgan vaqtda bo'sh xonalar
create or replace function public.free_rooms(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_mode public.time_mode,
  p_skip_weekends boolean default false,
  p_exclude_booking uuid default null
)
returns setof public.rooms
language sql stable security definer set search_path = public
as $$
  select r.* from public.rooms r
  where r.is_active and auth.uid() is not null
    and not exists (
      select 1
      from public.compute_slots(p_starts_at, p_ends_at, p_mode, p_skip_weekends) c
      join public.booking_slots s on s.room_id = r.id and s.active and s.during && c.during
      where p_exclude_booking is null or s.booking_id <> p_exclude_booking
    )
  order by r.sort_order
$$;

-- ─────────────────────────────── Bron yaratish / tahrirlash ─────────────
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
      trim(p ->> 'organization'), trim(p ->> 'event_title'), trim(p ->> 'contact_name'),
      p ->> 'contact_phone', nullif(trim(p ->> 'note'), ''),
      nullif(p ->> 'attendees', '')::int, nullif(p ->> 'color', ''), auth.uid()
    ) returning id into v_id;
  else
    v_id := p_id;
    update public.bookings set
      room_id = v_room.id, starts_at = v_starts, ends_at = v_ends, time_mode = v_mode,
      skip_weekends = v_skip,
      organization = trim(p ->> 'organization'), event_title = trim(p ->> 'event_title'),
      contact_name = trim(p ->> 'contact_name'), contact_phone = p ->> 'contact_phone',
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

create or replace function public.cancel_booking(p_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid;
begin
  select created_by into v_owner from public.bookings where id = p_id;
  if not found then raise exception 'Брон топилмади' using errcode = 'P0001'; end if;
  if not (public.is_super_admin() or (public.is_admin() and v_owner = auth.uid())) then
    raise exception 'Бу бронни бекор қилиш ҳуқуқингиз йўқ' using errcode = '42501';
  end if;
  update public.bookings
    set status = 'cancelled', cancel_reason = nullif(trim(p_reason), ''), updated_at = now()
    where id = p_id;
  update public.booking_slots set active = false where booking_id = p_id;
  insert into public.audit_log (actor, action, entity, entity_id, details)
  values (auth.uid(), 'cancel', 'booking', p_id, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.delete_booking(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Бронни бутунлай ўчириш фақат бош админ учун' using errcode = '42501';
  end if;
  delete from public.bookings where id = p_id;
  insert into public.audit_log (actor, action, entity, entity_id)
  values (auth.uid(), 'delete', 'booking', p_id);
end $$;

-- ─────────────────────────────── O'qish (telefon niqoblanadi) ────────────
create or replace function public.mask_phone(p text)
returns text language sql immutable
as $$
  select case when p ~ '^\+998\d{9}$'
    then '+998 ' || substr(p, 5, 2) || ' *** ** ' || substr(p, 12, 2)
    else '***' end
$$;

create or replace function public.get_bookings(
  p_from timestamptz,
  p_to timestamptz,
  p_include_cancelled boolean default false
)
returns table (
  id uuid, seq_no bigint, room_id uuid, room_name text,
  starts_at timestamptz, ends_at timestamptz, time_mode public.time_mode, skip_weekends boolean,
  organization text, event_title text, contact_name text, contact_phone text,
  note text, attendees int, color text, status public.booking_status, cancel_reason text,
  created_by uuid, created_by_email text, created_at timestamptz, updated_at timestamptz,
  slots jsonb, file_count int
)
language sql stable security definer set search_path = public
as $$
  select
    b.id, b.seq_no, b.room_id, r.name,
    b.starts_at, b.ends_at, b.time_mode, b.skip_weekends,
    b.organization, b.event_title, b.contact_name,
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

-- ─────────────────────────────── Rollarni boshqarish ────────────────────
create or replace function public.set_user_role(p_email text, p_role public.user_role)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_email text := lower(trim(p_email));
begin
  if not public.is_super_admin() then
    raise exception 'Фақат бош админ рол бера олади' using errcode = '42501';
  end if;
  if v_email = (select lower(value) from public.app_settings where key = 'super_admin_email') then
    raise exception 'Бош админ ролини ўзгартириб бўлмайди' using errcode = 'P0001';
  end if;
  if p_role = 'super_admin' then
    raise exception 'Бош админ фақат битта бўлади' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail нотўғри' using errcode = 'P0001';
  end if;
  insert into public.role_grants (email, role, granted_by)
  values (v_email, p_role, auth.uid())
  on conflict (email) do update set role = excluded.role, granted_by = excluded.granted_by;
  update public.profiles set role = p_role where email = v_email;
  insert into public.audit_log (actor, action, entity, details)
  values (auth.uid(), 'set_role', 'profile', jsonb_build_object('email', v_email, 'role', p_role));
end $$;

create or replace function public.set_user_blocked(p_user uuid, p_blocked boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Фақат бош админ блоклай олади' using errcode = '42501';
  end if;
  update public.profiles set is_blocked = p_blocked where id = p_user;
end $$;

-- ─────────────────────────────── RLS ───────────────────────────────────
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.role_grants enable row level security;
alter table public.rooms enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_slots enable row level security;
alter table public.booking_files enable row level security;
alter table public.audit_log enable row level security;

-- Profillar: o'zini ko'radi; bosh admin hammasini
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_super_admin());

drop policy if exists role_grants_select on public.role_grants;
create policy role_grants_select on public.role_grants for select to authenticated
  using (public.is_super_admin());

-- Xonalar: hamma ko'radi, bosh admin tahrirlaydi
drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select to authenticated using (true);
drop policy if exists rooms_write on public.rooms;
create policy rooms_write on public.rooms for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Bronlar to'g'ridan-to'g'ri faqat adminlarga (telefon to'liq). Boshqalar get_bookings() orqali.
drop policy if exists bookings_select_admin on public.bookings;
create policy bookings_select_admin on public.bookings for select to authenticated
  using (public.is_admin());
drop policy if exists slots_select on public.booking_slots;
create policy slots_select on public.booking_slots for select to authenticated using (true);

-- Fayllar: faqat adminlar
drop policy if exists files_select on public.booking_files;
create policy files_select on public.booking_files for select to authenticated
  using (public.is_admin());
drop policy if exists files_insert on public.booking_files;
create policy files_insert on public.booking_files for insert to authenticated
  with check (public.is_admin() and uploaded_by = auth.uid());
drop policy if exists files_delete on public.booking_files;
create policy files_delete on public.booking_files for delete to authenticated
  using (public.is_super_admin() or (public.is_admin() and uploaded_by = auth.uid()));

drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using (public.is_super_admin());

-- Yozish faqat security definer funksiyalar orqali
revoke insert, update, delete on public.bookings, public.booking_slots, public.profiles,
  public.role_grants, public.audit_log, public.app_settings from anon, authenticated;
revoke all on public.bookings, public.booking_slots, public.booking_files, public.profiles,
  public.role_grants, public.audit_log, public.app_settings, public.rooms from anon;

-- Supabase'нинг янги лойиҳаларида жадвалларга рухсат ўзи берилмайди: аниқ берамиз.
-- Ким нимани кўриши юқоридаги RLS қоидалари билан чекланади.
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.rooms, public.bookings, public.booking_slots,
  public.booking_files, public.role_grants, public.audit_log to authenticated;
grant insert, delete on public.booking_files to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

grant execute on function public.get_bookings(timestamptz, timestamptz, boolean) to authenticated;
grant execute on function public.check_availability(uuid, timestamptz, timestamptz, public.time_mode, boolean, uuid) to authenticated;
grant execute on function public.free_rooms(timestamptz, timestamptz, public.time_mode, boolean, uuid) to authenticated;
grant execute on function public.save_booking(jsonb, uuid) to authenticated;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
grant execute on function public.delete_booking(uuid) to authenticated;
grant execute on function public.set_user_role(text, public.user_role) to authenticated;
grant execute on function public.set_user_blocked(uuid, boolean) to authenticated;
revoke execute on function public.save_booking(jsonb, uuid) from anon;
revoke execute on function public.delete_booking(uuid) from anon;
revoke execute on function public.set_user_role(text, public.user_role) from anon;

-- ===== supabase/migrations/0002_storage.sql =====
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

-- ===== supabase/migrations/0003_seed_rooms.sql =====
-- «Хоналар 19.11.2026.xlsx» асосида 22 та зал ва хона
insert into public.rooms (name, kind, floor, capacity, capacity_alt, sort_order) values
  ('Катта мажлислар зали','hall',null,154,'Ўзгарган ҳолда: 80–90',1),
  ('Кичик мажлислар зали','hall',null,28,'Ўзгарган ҳолда: 40',2),
  ('105-хона','classroom',1,24,null,10),
  ('107-хона','classroom',1,20,null,11),
  ('108-хона','computer',1,16,null,12),
  ('109-хона','classroom',1,20,null,13),
  ('110-хона','classroom',1,24,null,14),
  ('111-хона','computer',1,16,null,15),
  ('113-хона','classroom',1,16,null,16),
  ('204-хона','classroom',2,20,null,17),
  ('205-хона','computer',2,16,null,18),
  ('206-хона','classroom',2,20,null,19),
  ('207-хона','classroom',2,30,null,20),
  ('208-хона','computer',2,16,null,21),
  ('210-хона','classroom',2,24,null,22),
  ('305-хона','classroom',3,24,null,23),
  ('307-хона','classroom',3,20,null,24),
  ('308-хона','computer',3,20,null,25),
  ('309-хона','classroom',3,20,null,26),
  ('310-хона','classroom',3,30,null,27),
  ('311-хона','computer',3,20,null,28),
  ('313-хона','classroom',3,24,null,29)
on conflict (name) do nothing;

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

-- ===== supabase/migrations/0005_event_topic.sql =====
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
