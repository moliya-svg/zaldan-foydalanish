import Link from "next/link";
import { CalendarPlus, CalendarRange, Clock, DoorOpen, Building2, TrendingUp } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { getBookings, getRooms } from "@/lib/data";
import { monthRange, todayTk, isNow, slotsOnDay, occupiedDays, MONTHS, fmtDate, tkTime, daysInMonth } from "@/lib/dates";
import { bookingColor } from "@/lib/colors";

const pad = (n: number) => String(n).padStart(2, "0");

export default async function Dashboard() {
  const viewer = await requireViewer();
  const t = todayTk();
  const { from, to } = monthRange(t.y, t.m);
  const weekEnd = new Date(Date.parse(`${t.y}-${pad(t.m)}-${pad(t.d)}T00:00:00+05:00`) + 8 * 86_400_000).toISOString();
  const [rooms, monthBookings, weekBookings] = await Promise.all([
    getRooms(),
    getBookings(from, to),
    getBookings(`${t.y}-${pad(t.m)}-${pad(t.d)}T00:00:00+05:00`, weekEnd),
  ]);

  const now = Date.now();
  const busyNow = weekBookings.filter((b) => isNow(b.slots, now));
  const busyRoomIds = new Set(busyNow.map((b) => b.room_id));
  const today = weekBookings.filter((b) => slotsOnDay(b.slots, t.y, t.m, t.d).length > 0);
  const freeToday = rooms.filter((r) => r.is_active && !today.some((b) => b.room_id === r.id));

  // Ойлик бандлик: банд кунлар / (хоналар × кунлар)
  const roomDays = new Map<string, number>();
  for (const b of monthBookings) roomDays.set(b.room_id, (roomDays.get(b.room_id) ?? 0) + occupiedDays(b.slots, t.y, t.m).size);
  const n = daysInMonth(t.y, t.m);
  const halls = rooms.filter((r) => r.kind === "hall");
  const hallLoad = halls.map((h) => ({ room: h, pct: Math.min(100, Math.round(((roomDays.get(h.id) ?? 0) / n) * 100)) }));
  const top = [...roomDays.entries()].sort((a, b) => b[1] - a[1])[0];
  const topRoom = top ? rooms.find((r) => r.id === top[0]) : null;

  // Кейинги 7 кун
  const upcoming: { day: string; label: string; items: typeof weekBookings }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.parse(`${t.y}-${pad(t.m)}-${pad(t.d)}T12:00:00+05:00`) + i * 86_400_000);
    const [yy, mm, dd] = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
    const items = weekBookings.filter((b) => slotsOnDay(b.slots, yy, mm, dd).length > 0);
    upcoming.push({ day: `${yy}-${pad(mm)}-${pad(dd)}`, label: i === 0 ? "Бугун" : i === 1 ? "Эртага" : fmtDate(d), items });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{fmtDate(new Date())}</p>
          <h1 className="text-2xl font-bold text-brand-900 dark:text-white">Хуш келибсиз</h1>
        </div>
        <div className="flex gap-2">
          {viewer.isAdmin && <Link href="/kiritish" className="btn btn-primary"><CalendarPlus className="size-4" />KIRITISH BRON</Link>}
          <Link href="/korish" className="btn btn-ghost"><CalendarRange className="size-4" />KO&apos;RISH BRON</Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<Clock />} label="Ҳозир банд" value={`${busyRoomIds.size} / ${rooms.length}`} hint="зал ва хона" />
        <Stat icon={<DoorOpen />} label="Бугун бутунлай бўш" value={String(freeToday.length)} hint="зал ва хона" />
        <Stat icon={<CalendarRange />} label={`${MONTHS[t.m - 1]}даги бронлар`} value={String(monthBookings.length)} hint="тасдиқланган" />
        <Stat icon={<TrendingUp />} label="Энг банд жой" value={topRoom?.name ?? "—"} hint={top ? `${top[1]} кун` : "шу ойда"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Яқин 7 кун</h2>
          <ol className="space-y-4">
            {upcoming.map((u) => (
              <li key={u.day}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{u.label}</p>
                {u.items.length === 0 ? <p className="text-sm text-muted">Тадбир йўқ</p> : (
                  <ul className="space-y-1.5">
                    {u.items.map((b) => {
                      const [yy, mm, dd] = u.day.split("-").map(Number);
                      return (
                        <li key={b.id}>
                          <Link href={`/korish?open=${b.id}`} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
                            <span className="h-8 w-1.5 rounded-full" style={{ background: bookingColor(b) }} />
                            <span className="w-24 shrink-0 tabular-nums text-muted">{slotsOnDay(b.slots, yy, mm, dd).join(", ")}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{b.event_title}</span>
                              <span className="block truncate text-xs text-muted">{b.organization}</span>
                            </span>
                            <span className="shrink-0 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-900 dark:bg-brand-950 dark:text-brand-100">{b.room_name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>

        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Заллар бандлиги · {MONTHS[t.m - 1]}</h2>
            <div className="space-y-3">
              {hallLoad.map(({ room, pct }) => (
                <div key={room.id}>
                  <div className="mb-1 flex justify-between text-sm"><span>{room.name}</span><span className="font-semibold tabular-nums">{pct}%</span></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-gold-500" style={{ width: `${pct}%` }} /></div>
                </div>
              ))}
            </div>
          </section>
          <section className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><Clock className="size-4" /> Ҳозир</h2>
            {busyNow.length === 0 ? <p className="text-sm text-muted">Ҳозир ҳеч қаерда тадбир йўқ.</p> : (
              <ul className="space-y-2 text-sm">
                {busyNow.map((b) => (
                  <li key={b.id} className="flex items-center gap-2">
                    <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-danger" /></span>
                    <b>{b.room_name}</b><span className="truncate text-muted">{b.event_title} · {tkTime(b.ends_at)} гача</span>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mb-2 mt-4 flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4" /> Бугун бўш</h3>
            <div className="flex flex-wrap gap-1.5">
              {freeToday.map((r) => (
                <span key={r.id} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{r.name}</span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactElement; label: string; value: string; hint: string }) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100 [&>svg]:size-5">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="truncate text-xl font-bold">{value}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
    </div>
  );
}
