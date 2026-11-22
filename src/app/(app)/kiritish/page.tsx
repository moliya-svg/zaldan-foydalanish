import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getRooms } from "@/lib/data";
import { getBookingFiles } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { BookingForm, type FormValues } from "@/components/BookingForm";
import { tkDate, tkTime, fmtDate, todayTk } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { bookingColor } from "@/lib/colors";

export const metadata: Metadata = { title: "KIRITISH BRON" };

const pad = (n: number) => String(n).padStart(2, "0");

export default async function KiritishPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const viewer = await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [rooms, recentRes, orgRes] = await Promise.all([
    getRooms(),
    supabase.from("bookings")
      .select("id, seq_no, starts_at, ends_at, time_mode, organization, event_title, contact_name, contact_phone, note, color, status, rooms(name), booking_files(kind)")
      .order("created_at", { ascending: false }).limit(15),
    supabase.from("bookings").select("organization").order("created_at", { ascending: false }).limit(300),
  ]);

  const t = todayTk();
  const today = `${t.y}-${pad(t.m)}-${pad(t.d)}`;
  let initial: FormValues = {
    room_id: sp.room ?? "", start_date: sp.date ?? today, start_time: "09:00", end_date: sp.date ?? today, end_time: "13:00",
    time_mode: "daily", skip_weekends: false, organization: "", event_title: "", contact_name: "", contact_phone: "",
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
        organization: b.organization, event_title: b.event_title, contact_name: b.contact_name,
        contact_phone: formatPhone(b.contact_phone), note: b.note ?? "", attendees: b.attendees ? String(b.attendees) : "",
        color: b.color ?? "",
      };
      if (sp.edit) {
        editId = b.id;
        existingFiles = await getBookingFiles(b.id);
      }
    }
  }

  const organizations = [...new Set((orgRes.data ?? []).map((r) => r.organization))].slice(0, 100);
  type Recent = {
    id: string; seq_no: number; starts_at: string; ends_at: string; organization: string; event_title: string;
    contact_name: string; contact_phone: string; note: string | null; color: string | null; status: string;
    rooms: { name: string } | null; booking_files: { kind: string }[];
  };
  const recent = (recentRes.data ?? []) as unknown as Recent[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900 dark:text-white">{editId ? "Бронни таҳрирлаш" : "KIRITISH BRON"}</h1>
        <p className="text-sm text-muted">Ҳар бир маълумот алоҳида устунда. Банд вақт танланса, тизим дарҳол огоҳлантиради.</p>
      </div>

      <BookingForm key={source ?? "new"} rooms={rooms} initial={initial} editId={editId} userId={viewer.id} existingFiles={existingFiles} organizations={organizations} />

      {!editId && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold">Охирги киритилган бронлар</h2>
            <Link href="/korish" className="text-sm font-medium text-brand-800 hover:underline dark:text-brand-100">Барчасини кўриш →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-brand-50 text-left text-xs text-brand-900 dark:bg-brand-950 dark:text-brand-100">
                <tr>
                  {["№", "Зал / хона", "Бошланиш санаси", "Бошл. соати", "Тугаш санаси", "Туг. соати", "Ташкилот", "Тадбир", "Ф.И.Ш.", "Телефон", "Изоҳ", "PDF", "JPEG"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr><td colSpan={13} className="px-3 py-8 text-center text-muted">Ҳали брон киритилмаган.</td></tr>
                )}
                {recent.map((b) => (
                  <tr key={b.id} className={`border-t border-line ${b.status === "cancelled" ? "opacity-50 line-through" : ""}`}>
                    <td className="px-3 py-2">
                      <Link href={`/korish?open=${b.id}`} className="inline-flex items-center gap-2 font-semibold hover:underline">
                        <span className="size-2.5 rounded-full" style={{ background: bookingColor(b) }} />{b.seq_no}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{b.rooms?.name}</td>
                    <td className="px-3 py-2">{fmtDate(b.starts_at)}</td>
                    <td className="px-3 py-2">{tkTime(b.starts_at)}</td>
                    <td className="px-3 py-2">{fmtDate(b.ends_at)}</td>
                    <td className="px-3 py-2">{tkTime(b.ends_at)}</td>
                    <td className="max-w-48 truncate px-3 py-2">{b.organization}</td>
                    <td className="max-w-40 truncate px-3 py-2">{b.event_title}</td>
                    <td className="whitespace-nowrap px-3 py-2">{b.contact_name}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatPhone(b.contact_phone)}</td>
                    <td className="max-w-40 truncate px-3 py-2 text-muted">{b.note}</td>
                    <td className="px-3 py-2 text-center">{b.booking_files.filter((f) => f.kind === "pdf").length || "—"}</td>
                    <td className="px-3 py-2 text-center">{b.booking_files.filter((f) => f.kind === "jpeg").length || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
