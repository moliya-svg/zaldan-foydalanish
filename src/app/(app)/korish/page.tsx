import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireViewer } from "@/lib/auth";
import { getBookings, getRooms } from "@/lib/data";
import { monthRange, todayTk, tkParts } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { BookingBoard } from "@/components/BookingBoard";

export const metadata: Metadata = { title: "Банд зал ва хоналар" };

export default async function KorishPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;

  // ?open=<id> ойсиз келса — шу брон бошланган ойга ўтамиз
  if (sp.open && !sp.y) {
    const supabase = await createClient();
    const { data } = await supabase.from("booking_slots").select("during").eq("booking_id", sp.open).limit(1).maybeSingle();
    const first = data?.during ? String(data.during).replace(/^[[(]"?/, "").split(",")[0].replace(/"/g, "") : null;
    if (first) {
      const p = tkParts(first.replace(" ", "T").replace(/\+(\d\d)$/, "+$1:00"));
      if (!Number.isNaN(p.y)) redirect(`/korish?y=${p.y}&m=${p.m}&open=${sp.open}`);
    }
  }

  const t = todayTk();
  const y = Math.min(2100, Math.max(2020, Number(sp.y) || t.y));
  const m = Math.min(12, Math.max(1, Number(sp.m) || t.m));
  const view = sp.view === "rooms" ? "rooms" : "bookings";
  const { from, to } = monthRange(y, m);
  const [rooms, bookings] = await Promise.all([getRooms(), getBookings(from, to)]);

  return (
    <Suspense>
      <BookingBoard year={y} month={m} view={view} rooms={rooms} bookings={bookings} viewer={viewer} />
    </Suspense>
  );
}
