// Фақат ишлаб чиқиш режимида: Supabase'сиз интерфейсни кўриш учун намунавий маълумотлар.
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { BookingBoard } from "@/components/BookingBoard";
import { BookingForm } from "@/components/BookingForm";
import { AdminManager } from "@/components/AdminManager";
import { fixtureBookings, fixtureRooms, fixtureViewer } from "./fixtures";

export default async function Preview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const sp = await searchParams;
  const rooms = fixtureRooms();
  const view = sp.view === "rooms" ? "rooms" : "bookings";
  return (
    <AppShell viewer={fixtureViewer}>
      {sp.screen === "boshqaruv" ? (
        <AdminManager selfId={fixtureViewer.id} rows={[
          { id: fixtureViewer.id, email: "ilxomovb2023@gmail.com", full_name: "Илхомов Бахтиёр", role: "super_admin", is_blocked: false, created_at: null, pending: false },
          { id: "u2", email: "h.iroda1985@gmail.com", full_name: "Ҳамидова Ирода", role: "admin", is_blocked: false, created_at: null, pending: false },
          { id: null, email: "new.user@example.com", full_name: null, role: "admin", is_blocked: false, created_at: null, pending: true },
        ]} />
      ) : sp.screen === "kiritish" ? (
        <BookingForm rooms={rooms} userId={fixtureViewer.id} initial={{ room_id: rooms[0].id, start_date: "2026-11-24", start_time: "09:00", end_date: "2026-11-26", end_time: "13:00", time_mode: "daily", skip_weekends: false, organization: "", event_title: "", event_topic: "", contact_name: "", contact_phone: "", note: "", attendees: "", color: "" }} />
      ) : (
        <Suspense><BookingBoard year={2026} month={11} view={view} rooms={rooms} bookings={fixtureBookings(rooms)} viewer={fixtureViewer} /></Suspense>
      )}
    </AppShell>
  );
}
