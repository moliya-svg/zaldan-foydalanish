import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getRooms } from "@/lib/data";
import { getBookingFiles } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { BookingForm, type FormValues } from "@/components/BookingForm";
import { tkDate, tkTime, todayTk } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Киритиш" };

const pad = (n: number) => String(n).padStart(2, "0");

export default async function KiritishPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const viewer = await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [rooms, orgRes] = await Promise.all([
    getRooms(),
    supabase.from("bookings").select("organization").order("created_at", { ascending: false }).limit(300),
  ]);

  const t = todayTk();
  const today = `${t.y}-${pad(t.m)}-${pad(t.d)}`;
  let initial: FormValues = {
    room_id: sp.room ?? "", start_date: sp.date ?? today, start_time: "09:00", end_date: sp.date ?? today, end_time: "13:00",
    time_mode: "daily", skip_weekends: false, organization: "", event_title: "", event_topic: "", contact_name: "", contact_phone: "",
    note: "", attendees: "", color: "",
  };

  let editId: string | undefined;
  let existingFiles: Awaited<ReturnType<typeof getBookingFiles>> = [];
  const source = sp.edit ?? sp.copy;
  if (source) {
    const { data: b } = await supabase.from("bookings").select("*").eq("id", source).single();
    if (b) {
      initial = {
        room_id: b.room_id, start_date: tkDate(b.starts_at), start_time: tkTime(b.starts_at),
        end_date: tkDate(b.ends_at), end_time: tkTime(b.ends_at), time_mode: b.time_mode, skip_weekends: b.skip_weekends,
        organization: b.organization, event_title: b.event_title, event_topic: b.event_topic ?? "", contact_name: b.contact_name ?? "",
        contact_phone: b.contact_phone ? formatPhone(b.contact_phone) : "", note: b.note ?? "", attendees: b.attendees ? String(b.attendees) : "",
        color: b.color ?? "",
      };
      if (sp.edit) {
        editId = b.id;
        existingFiles = await getBookingFiles(b.id);
      }
    }
  }

  const organizations = [...new Set((orgRes.data ?? []).map((r) => r.organization))].slice(0, 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900 dark:text-white">{editId ? "Бронни таҳрирлаш" : "Киритиш"}</h1>
        <p className="text-sm text-muted">Ҳар бир маълумот алоҳида устунда. Банд вақт танланса, тизим дарҳол огоҳлантиради.</p>
      </div>

      <BookingForm key={source ?? "new"} rooms={rooms} initial={initial} editId={editId} userId={viewer.id} existingFiles={existingFiles} organizations={organizations} />
    </div>
  );
}
