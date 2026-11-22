import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { getBookings } from "@/lib/data";
import { fmtDate, fmtDateTime, tkTime, todayTk } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { bookingColor } from "@/lib/colors";

export const metadata: Metadata = { title: "Ўтган тадбирлар" };

export default async function UtganPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireViewer();
  const sp = await searchParams;
  const t = todayTk();
  const y = Math.min(t.y, Math.max(2020, Number(sp.y) || t.y));
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const from = `${y}-01-01T00:00:00+05:00`;
  const to = y === t.y ? nowIso : `${y + 1}-01-01T00:00:00+05:00`;

  // Тугаш вақти ўтиб кетган бронлар, энг яқинда тугагани биринчи
  const past = (await getBookings(from, to))
    .filter((b) => Date.parse(b.ends_at) <= now)
    .sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at));

  const years = Array.from({ length: Math.min(5, t.y - 2025) }, (_, i) => t.y - i).filter((v) => v >= 2026);
  if (!years.includes(y)) years.push(y);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-900 dark:text-white">Ўтган тадбирлар</h1>
          <p className="text-sm text-muted">Тугаш вақти ўтган бронлар. Энг охирги тугагани юқорида.</p>
        </div>
        {years.length > 1 && (
          <div className="flex gap-1" aria-label="Йил">
            {years.sort((a, b) => b - a).map((v) => (
              <Link key={v} href={`/utgan?y=${v}`} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${v === y ? "bg-gold-500 text-brand-950" : "bg-canvas text-muted hover:bg-brand-50"}`}>{v}</Link>
            ))}
          </div>
        )}
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-semibold">{y} йил</h2>
          <span className="text-sm text-muted">{past.length} та тадбир</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1450px] text-sm">
            <thead className="bg-brand-50 text-left text-xs text-brand-900 dark:bg-brand-950 dark:text-brand-100">
              <tr>
                {["№", "Зал / хона", "Бошланиш санаси", "Бошл. соати", "Тугаш санаси", "Туг. соати", "Ташкилот", "Тадбир", "Тадбир мавзуси", "Ф.И.Ш.", "Телефон", "Изоҳ", "Файл", "Ким киритган"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {past.length === 0 && (
                <tr><td colSpan={14} className="px-3 py-8 text-center text-muted">Бу йилда ўтган тадбир йўқ.</td></tr>
              )}
              {past.map((b) => (
                <tr key={b.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <Link href={`/korish?open=${b.id}`} className="inline-flex items-center gap-2 font-semibold hover:underline">
                      <span className="size-2.5 rounded-full" style={{ background: bookingColor(b) }} />{b.seq_no}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{b.room_name}</td>
                  <td className="px-3 py-2">{fmtDate(b.starts_at)}</td>
                  <td className="px-3 py-2">{tkTime(b.starts_at)}</td>
                  <td className="px-3 py-2">{fmtDate(b.ends_at)}</td>
                  <td className="px-3 py-2">{tkTime(b.ends_at)}</td>
                  <td className="max-w-48 truncate px-3 py-2" title={b.organization}>{b.organization}</td>
                  <td className="max-w-48 truncate px-3 py-2" title={b.event_title}>{b.event_title}</td>
                  <td className="max-w-56 truncate px-3 py-2 text-xs text-muted" title={b.event_topic ?? ""}>{b.event_topic ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{b.contact_name ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{b.contact_phone ? formatPhone(b.contact_phone) : "—"}</td>
                  <td className="max-w-40 truncate px-3 py-2 text-muted" title={b.note ?? ""}>{b.note}</td>
                  <td className="px-3 py-2 text-center">{b.file_count || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs leading-tight">
                    {b.created_by_name && <div className="font-semibold">{b.created_by_name}</div>}
                    <div className={b.created_by_name ? "text-muted" : "font-medium"}>{b.created_by_email ?? "—"}</div>
                    <div className="tabular-nums text-muted">{fmtDateTime(b.created_at)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
