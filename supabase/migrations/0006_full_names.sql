-- 0006: Фойдаланувчиларнинг Ф.И.Ш.
-- Ҳали кирмаган e-mail учун ҳам Ф.И.Ш. олдиндан сақланади
alter table public.role_grants
  add column if not exists full_name text
  check (full_name is null or char_length(full_name) <= 120);

-- Янги ҳисоб очилганда Ф.И.Ш. метадатадан ёки role_grants'дан олинади
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(new.email);
  v_role public.user_role := 'viewer';
  v_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
begin
  if v_email = (select lower(value) from public.app_settings where key = 'super_admin_email') then
    v_role := 'super_admin';
  else
    select g.role into v_role from public.role_grants g where g.email = v_email;
    v_role := coalesce(v_role, 'viewer');
  end if;
  if v_name is null then
    select nullif(trim(g.full_name), '') into v_name from public.role_grants g where g.email = v_email;
  end if;
  insert into public.profiles (id, email, full_name, role)
  values (new.id, v_email, v_name, v_role)
  on conflict (id) do nothing;
  return new;
end $$;

-- Бош админ Ф.И.Ш.ни ўзгартиради
create or replace function public.set_user_name(p_email text, p_full_name text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_name text := nullif(trim(p_full_name), '');
begin
  if not public.is_super_admin() then
    raise exception 'Фақат бош админ Ф.И.Ш.ни ўзгартира олади' using errcode = '42501';
  end if;
  if char_length(v_name) > 120 then
    raise exception 'Ф.И.Ш. 120 белгидан ошмасин' using errcode = 'P0001';
  end if;
  update public.profiles set full_name = v_name where email = v_email;
  update public.role_grants set full_name = v_name where email = v_email;
end $$;

revoke execute on function public.set_user_name(text, text) from public, anon;
grant execute on function public.set_user_name(text, text) to authenticated;

-- ─── Фойдаланувчини ўчириш ───
-- Ўчирилган фойдаланувчи киритган бронлар қолади: ким киритгани нусхаланади
alter table public.bookings
  add column if not exists creator_email text,
  add column if not exists creator_name text;

alter table public.bookings drop constraint if exists bookings_created_by_fkey;
alter table public.bookings add constraint bookings_created_by_fkey
  foreign key (created_by) references public.profiles on delete set null;
alter table public.booking_files drop constraint if exists booking_files_uploaded_by_fkey;
alter table public.booking_files add constraint booking_files_uploaded_by_fkey
  foreign key (uploaded_by) references public.profiles on delete set null;
alter table public.audit_log drop constraint if exists audit_log_actor_fkey;
alter table public.audit_log add constraint audit_log_actor_fkey
  foreign key (actor) references public.profiles on delete set null;
alter table public.role_grants drop constraint if exists role_grants_granted_by_fkey;
alter table public.role_grants add constraint role_grants_granted_by_fkey
  foreign key (granted_by) references public.profiles on delete set null;

create or replace function public.before_profile_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if lower(old.email) = (select lower(value) from public.app_settings where key = 'super_admin_email') then
    raise exception 'Бош админни ўчириб бўлмайди' using errcode = 'P0001';
  end if;
  update public.bookings
    set creator_email = old.email, creator_name = old.full_name
    where created_by = old.id;
  delete from public.role_grants where email = lower(old.email);
  return old;
end $$;

drop trigger if exists profiles_before_delete on public.profiles;
create trigger profiles_before_delete
  before delete on public.profiles
  for each row execute function public.before_profile_delete();

-- Ҳали кирмаган (фақат рол берилган) e-mail'ни ўчириш
create or replace function public.delete_role_grant(p_email text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Фақат бош админ ўчира олади' using errcode = '42501';
  end if;
  delete from public.role_grants where email = lower(trim(p_email));
end $$;

revoke execute on function public.delete_role_grant(text) from public, anon;
grant execute on function public.delete_role_grant(text) to authenticated;
revoke execute on function public.before_profile_delete() from public, anon, authenticated;

-- Брон кимдан эканини Ф.И.Ш. билан қайтарамиз
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
  created_by uuid, created_by_email text, created_by_name text, created_at timestamptz, updated_at timestamptz,
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
    b.created_by, coalesce(cp.email, b.creator_email), coalesce(cp.full_name, b.creator_name), b.created_at, b.updated_at,
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
