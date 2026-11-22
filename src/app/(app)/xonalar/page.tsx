import type { Metadata } from "next";
import Link from "next/link";
import { Users, Monitor, Presentation, Landmark } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { getBookings, getRooms } from "@/lib/data";
import { todayTk, slotsOnDay } from "@/lib/dates";
import { ROOM_KIND_LABEL, type Room } from "@/lib/types";

export const metadata: Metadata = { title: "Зал ва хоналар" };
const pad = (n: number) => String(n).padStart(2, "0");

export default async function XonalarPage() {
  const viewer = await requireViewer();
  const t = todayTk();
  const start = `${t.y}-${pad(t.m)}-${pad(t.d)}T00:00:00+05:00`;
  const end = new Date(Date.parse(start) + 7 * 86_400_000).toISOString();
  const [rooms, week] = await Promise.all([getRooms(), getBookings(start, end)]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.parse(start) + i * 86_400_000 + 12 * 3_600_000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  });
  const groups: { title: string; rooms: Room[] }[] = [
    { title: "Мажлислар заллари", rooms: rooms.filter((r) => r.kind === "hall") },
    ...[1, 2, 3].map((f) => ({ title: `${f}-қават`, rooms: rooms.filter((r) => r.kind !== "hall" && r.floor === f) })),
  ].filter((g) => g.rooms.length);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900 dark:text-white">Зал ва хоналар</h1>
        <p className="text-sm text-muted">{rooms.length} та жой · жами {rooms.reduce((s, r) => s + r.capacity, 0)} ўрин. Пастдаги чизиқ — кейинги 7 кунлик бандлик.</p>
      </div>
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{g.title}</h2>
          <div className={`grid gap-3 ${g.rooms[0].kind === "hall" ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"}`}>
            {g.rooms.map((r) => {
              const rb = week.filter((b) => b.room_id === r.id);
              const Icon = r.kind === "hall" ? Landmark : r.kind === "computer" ? Monitor : Presentation;
              return (
                <div key={r.id} className={`card p-4 ${r.kind === "hall" ? "border-l-4 !border-l-gold-500" : ""} ${!r.is_active ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100"><Icon className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <h3 className={`font-bold ${r.kind === "hall" ? "text-lg" : ""}`}>{r.name}</h3>
                      <p className="text-xs text-muted">{ROOM_KIND_LABEL[r.kind]}{!r.is_active && " · вақтинча ёпиқ"}</p>
                    </div>
                    <div className="text-right">
                      <p className="flex items-center gap-1 font-bold"><Users className="size-4 text-muted" />{r.capacity}</p>
                      {r.capacity_alt && <p className="text-[11px] text-muted">{r.capacity_alt.replace("Ўзгарган ҳолда: ", "ўзгарган: ")}</p>}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-7 gap-1" aria-label="Кейинги 7 кун">
                    {days.map((d, i) => {
                      const busy = rb.filter((b) => slotsOnDay(b.slots, d.y, d.m, d.d).length > 0);
                      return (
                        <div key={i} title={busy.map((b) => `${b.event_title}: ${slotsOnDay(b.slots, d.y, d.m, d.d).join(", ")}`).join("\n") || "Бўш"}
                          className={`h-6 rounded text-center text-[10px] leading-6 ${busy.length ? "bg-brand-800 text-white" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"}`}>
                          {d.d}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex gap-2 text-sm">
                    <Link href={`/korish?view=rooms&room=${r.id}`} className="font-medium text-brand-800 hover:underline dark:text-brand-100">Жадвал</Link>
                    {viewer.isAdmin && r.is_active && <Link href={`/kiritish?room=${r.id}`} className="ml-auto font-medium text-brand-800 hover:underline dark:text-brand-100">Брон қилиш →</Link>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
