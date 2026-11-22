"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { bookingSchema, type BookingInput } from "./validation";
import { toIso, fmtDateTime } from "./dates";
import type { Room, Role, TimeMode } from "./types";

export interface Conflict {
  booking_id: string;
  seq_no: number;
  organization: string;
  event_title: string;
  slot_start: string;
  slot_end: string;
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string>; conflict?: Conflict };

function conflictMessage(c: Conflict | undefined): string {
  if (!c?.organization) return "Бу вақтда хона аллақачон банд.";
  return `Бу вақтда хона банд: №${c.seq_no} «${c.organization}» — ${c.event_title} (${fmtDateTime(c.slot_start)} – ${fmtDateTime(c.slot_end)}).`;
}

export async function saveBooking(input: BookingInput, id?: string): Promise<SaveResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "form");
      fieldErrors[k] ??= issue.message;
    }
    return { ok: false, message: "Майдонларни текширинг.", fieldErrors };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_booking", {
    p: {
      room_id: v.room_id,
      starts_at: toIso(v.start_date, v.start_time),
      ends_at: toIso(v.end_date, v.end_time),
      time_mode: v.time_mode,
      skip_weekends: v.skip_weekends,
      organization: v.organization,
      event_title: v.event_title,
      contact_name: v.contact_name ?? "",
      contact_phone: v.contact_phone ?? "",
      note: v.note ?? "",
      attendees: v.attendees ?? "",
      color: v.color ?? "",
    },
    p_id: id ?? null,
  });
  if (error) {
    if (error.code === "P0002") {
      let c: Conflict | undefined;
      try { c = JSON.parse(error.details ?? "{}"); } catch { /* бўш */ }
      return { ok: false, message: conflictMessage(c), conflict: c?.organization ? c : undefined };
    }
    return { ok: false, message: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true, id: data as string };
}

export async function checkAvailability(args: {
  room_id: string; start_date: string; start_time: string; end_date: string; end_time: string;
  time_mode: TimeMode; skip_weekends: boolean; exclude?: string;
}): Promise<{ conflicts: Conflict[]; freeRooms: Pick<Room, "id" | "name" | "capacity">[]; error?: string }> {
  const supabase = await createClient();
  const p = {
    p_starts_at: toIso(args.start_date, args.start_time),
    p_ends_at: toIso(args.end_date, args.end_time),
    p_mode: args.time_mode,
    p_skip_weekends: args.skip_weekends,
    p_exclude_booking: args.exclude ?? null,
  };
  const [c, f] = await Promise.all([
    args.room_id ? supabase.rpc("check_availability", { p_room_id: args.room_id, ...p }) : Promise.resolve({ data: [], error: null }),
    supabase.rpc("free_rooms", p).select("id, name, capacity"),
  ]);
  const err = c.error ?? f.error;
  if (err) return { conflicts: [], freeRooms: [], error: err.message };
  return { conflicts: (c.data ?? []) as Conflict[], freeRooms: (f.data ?? []) as Pick<Room, "id" | "name" | "capacity">[] };
}

export async function cancelBooking(id: string, reason: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", { p_id: id, p_reason: reason });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteBooking(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { data: files } = await supabase.from("booking_files").select("path").eq("booking_id", id);
  const { error } = await supabase.rpc("delete_booking", { p_id: id });
  if (error) return { ok: false, message: error.message };
  if (files?.length) await supabase.storage.from("booking-files").remove(files.map((f) => f.path));
  revalidatePath("/", "layout");
  return { ok: true };
}

export interface FileLink { id: string; kind: "pdf" | "jpeg"; name: string; size: number; url: string }

export async function getBookingFiles(bookingId: string): Promise<FileLink[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_files")
    .select("id, kind, path, original_name, size_bytes")
    .eq("booking_id", bookingId)
    .order("created_at");
  if (!data?.length) return [];
  const { data: signed } = await supabase.storage
    .from("booking-files")
    .createSignedUrls(data.map((f) => f.path), 300);
  return data.map((f, i) => ({
    id: f.id,
    kind: f.kind,
    name: f.original_name ?? f.path.split("/").pop()!,
    size: f.size_bytes ?? 0,
    url: signed?.[i]?.signedUrl ?? "",
  }));
}

export async function deleteBookingFile(fileId: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("booking_files").delete().eq("id", fileId).select("path").single();
  if (error || !data) return { ok: false, message: error?.message ?? "Файл топилмади" };
  await supabase.storage.from("booking-files").remove([data.path]);
  return { ok: true };
}

export async function setUserRole(email: string, role: Exclude<Role, "super_admin">): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", { p_email: email, p_role: role });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/boshqaruv");
  return { ok: true };
}

export async function setUserBlocked(userId: string, blocked: boolean): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_blocked", { p_user: userId, p_blocked: blocked });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/boshqaruv");
  return { ok: true };
}
