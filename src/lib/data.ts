import "server-only";
import { createClient } from "./supabase/server";
import type { Booking, Room } from "./types";

export async function getRooms(): Promise<Room[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("rooms").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return data as Room[];
}

export async function getBookings(from: string, to: string, includeCancelled = false): Promise<Booking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_bookings", {
    p_from: from,
    p_to: to,
    p_include_cancelled: includeCancelled,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as Booking[];
}
