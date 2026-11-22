"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Printer, Search, Rows3, Building2, CalendarDays, Pencil, Trash2, Ban, CalendarPlus } from "lucide-react";
import { MONTHS, MONTHS_SHORT, WEEKDAYS_SHORT, daysInMonth, weekday, occupiedDays, toSegments, slotsOnDay, tkDate, tkTime, todayTk } from "@/lib/dates";
import { bookingColor } from "@/lib/colors";
import type { Booking, Room, Viewer } from "@/lib/types";
import { BookingDrawer } from "./BookingDrawer";

type View = "bookings" | "rooms";

export function BookingBoard({ year, month, view, rooms, bookings, viewer }: {
  year: number; month: number; view: View; rooms: Room[]; bookings: Booking[]; viewer: Viewer;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [roomFilter, setRoomFilter] = useState(sp.get("room") ?? "");
  const [openId, setOpenId] = useState<string | null>(sp.get("open"));
  const [startWith, setStartWith] = useState<"cancel" | "delete" | null>(null);
  const [widths, setWidths] = useColumnWidths();
  const n = daysInMonth(year, month);
  const today = todayTk();
  const todayCol = today.y === year && today.m === month ? today.d : null;

  const href = (patch: Record<string, string | number | null>) => {
    const p = new URLSearchParams(sp.toString());
    p.delete("open");
    for (const [k, v] of Object.entries(patch)) v === null ? p.delete(k) : p.set(k, String(v));
    return `/korish?${p.toString()}`;
  };

  // Клавиатура: ← → ой, T бугун
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || openId) return;
      if (e.key === "ArrowLeft") router.push(href(month === 1 ? { y: year - 1, m: 12 } : { m: month - 1 }));
      if (e.key === "ArrowRight") router.push(href(month === 12 ? { y: year + 1, m: 1 } : { m: month + 1 }));
      if (e.key.toLowerCase() === "t" || e.key.toLowerCase() === "е") router.push(href({ y: today.y, m: today.m }));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return bookings.filter((b) =>
      (!roomFilter || b.room_id === roomFilter) &&
      (!s || [b.organization, b.event_title, b.contact_name, b.contact_phone, b.room_name, String(b.seq_no)].some((x) => x?.toLowerCase().includes(s))),
    );
  }, [bookings, q, roomFilter]);

  // Танланган ойни кўринадиган жойга суриш (телефонда)
  useEffect(() => {
    document.querySelector('[data-month-active="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [month]);

  const open = bookings.find((b) => b.id === openId) ?? null;
  const setOpen = (id: string | null, action: "cancel" | "delete" | null = null) => {
    setStartWith(action);
    setOpenId(id);
    const p = new URLSearchParams(window.location.search);
    id ? p.set("open", id) : p.delete("open");
    window.history.replaceState(null, "", `/korish?${p.toString()}`);
  };

  const dayHeads = Array.from({ length: n }, (_, i) => i + 1);
  const isWeekend = (d: number) => weekday(year, month, d) >= 5;
  const showActions = view === "bookings" && viewer.isAdmin;
  const cols = `var(--left) repeat(${n}, minmax(var(--day), 1fr))${showActions ? " var(--act)" : ""}`;
  const canEdit = (b: Booking) => viewer.isSuperAdmin || (viewer.isAdmin && b.created_by === viewer.id);

  return (
    <div className="space-y-4">
      {/* Юқори панел */}
      <div className="card space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-2 text-xl font-bold text-brand-900 dark:text-white sm:text-2xl">KO&apos;RISH BRON</h1>
          <div className="flex items-center rounded-lg border border-line" aria-label="Йил">
            <Link href={href({ y: year - 1 })} className="p-2 hover:bg-canvas" aria-label="Олдинги йил"><ChevronLeft className="size-4" /></Link>
            <span className="min-w-14 text-center font-bold tabular-nums">{year}</span>
            <Link href={href({ y: year + 1 })} className="p-2 hover:bg-canvas" aria-label="Кейинги йил"><ChevronRight className="size-4" /></Link>
          </div>
          <Link href={href({ y: today.y, m: today.m })} className="btn btn-ghost !min-h-9 !py-1.5 text-sm">Бугун</Link>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {viewer.isAdmin && (
              <Link href="/kiritish" className="btn btn-primary no-print !min-h-9 !py-1.5 text-sm"><CalendarPlus className="size-4" />KIRITISH BRON</Link>
            )}
            <div className="inline-flex rounded-lg border border-line p-0.5 text-sm" role="tablist">
              <Link href={href({ view: "bookings" })} role="tab" aria-selected={view === "bookings"} className={clsx("flex items-center gap-1.5 rounded-md px-2.5 py-1.5", view === "bookings" ? "bg-brand-900 text-white" : "text-muted")}>
                <Rows3 className="size-4" /> Бронлар
              </Link>
              <Link href={href({ view: "rooms" })} role="tab" aria-selected={view === "rooms"} className={clsx("flex items-center gap-1.5 rounded-md px-2.5 py-1.5", view === "rooms" ? "bg-brand-900 text-white" : "text-muted")}>
                <Building2 className="size-4" /> Хоналар
              </Link>
            </div>
            <button onClick={() => window.print()} className="btn btn-ghost no-print !min-h-9 !px-2.5 !py-1.5" aria-label="Чоп этиш" title="Чоп этиш"><Printer className="size-4" /></button>
          </div>
        </div>

        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Ойлар">
          {MONTHS_SHORT.map((label, i) => (
            <Link key={label} href={href({ m: i + 1 })} role="tab" aria-selected={month === i + 1} data-month-active={month === i + 1}
              className={clsx("shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition", month === i + 1 ? "bg-gold-500 text-brand-950 shadow" : "bg-canvas text-muted hover:bg-brand-50 hover:text-brand-900")}>
              {label}
            </Link>
          ))}
        </div>

        <div className="no-print flex flex-wrap gap-2">
          <label className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input className="field-input !min-h-9 !py-1.5 pl-9" placeholder="Қидириш: ФИШ, телефон, ташкилот, тадбир, №" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <select className="field-input !min-h-9 !w-auto !py-1.5" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} aria-label="Зал ёки хона">
            <option value="">Барча зал ва хоналар</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-lg font-semibold">{MONTHS[month - 1]} {year}</h2>
        <span className="text-sm text-muted">{filtered.length} та брон</span>
      </div>

      {/* Жадвал */}
      <div className="card overflow-x-auto [--act:64px] sm:[--act:76px] [--day:24px] [--left:190px] sm:[--left:calc(var(--room)+var(--event)+60px)] xl:[--day:26px]" style={{ WebkitOverflowScrolling: "touch", ["--room" as string]: `${widths.room}px`, ["--event" as string]: `${widths.event}px` }}>
        <div className="min-w-fit">
          {/* Сарлавҳа */}
          <div className="sticky top-0 z-20 grid border-b border-line bg-surface text-xs" style={{ gridTemplateColumns: cols }}>
            <div className="sticky left-0 z-10 flex items-end bg-surface px-2 py-2 font-semibold text-muted shadow-[1px_0_0_var(--line)]">
              {view === "bookings" ? (
                <div className="flex w-full gap-2">
                  <span className="w-7 shrink-0">№</span>
                  <span className="relative flex-1 sm:w-[var(--room)] sm:flex-none">
                    Зал / хона<span className="sm:hidden"> · Тадбир</span>
                    <Resizer label="Зал / хона" value={widths.room} onChange={(room) => setWidths({ ...widths, room })} />
                  </span>
                  <span className="relative hidden sm:block sm:w-[var(--event)] sm:flex-none">
                    Тадбир
                    <Resizer label="Тадбир" value={widths.event} onChange={(event) => setWidths({ ...widths, event })} />
                  </span>
                </div>
              ) : <span>Зал / хона</span>}
            </div>
            {dayHeads.map((d) => (
              <div key={d} className={clsx("flex flex-col items-center py-1.5 leading-tight", isWeekend(d) && "bg-weekend", d === todayCol && "!bg-gold-100 text-brand-950")}>
                <span className="text-[10px] text-muted">{WEEKDAYS_SHORT[weekday(year, month, d)]}</span>
                <span className="font-bold tabular-nums">{d}</span>
              </div>
            ))}
            {showActions && <div className="no-print sticky right-0 z-10 flex items-end justify-center bg-surface px-1 py-2 font-semibold text-muted shadow-[-1px_0_0_var(--line)]">Амаллар</div>}
          </div>

          {view === "bookings" ? (
            filtered.length === 0 ? (
              <Empty canAdd={viewer.isAdmin} />
            ) : (
              filtered.map((b, idx) => {
                const segs = toSegments(occupiedDays(b.slots, year, month));
                const color = bookingColor(b);
                const before = tkDate(b.starts_at) < `${year}-${String(month).padStart(2, "0")}-01`;
                const after = tkDate(new Date(Date.parse(b.ends_at) - 1)) > `${year}-${String(month).padStart(2, "0")}-${n}`;
                const hours = b.time_mode === "daily" ? `${tkTime(b.slots[0]?.[0] ?? b.starts_at)}–${tkTime(b.slots[0]?.[1] ?? b.ends_at)}` : `${tkTime(b.starts_at)}→${tkTime(b.ends_at)}`;
                return (
                  <div key={b.id} className="group grid border-b border-line text-sm last:border-b-0 hover:bg-canvas/60" style={{ gridTemplateColumns: cols }}>
                    <button onClick={() => setOpen(b.id)} className="sticky left-0 z-10 flex items-center gap-2 bg-surface px-2 py-1.5 text-left shadow-[1px_0_0_var(--line)] group-hover:bg-canvas" style={{ gridRow: 1, gridColumn: 1 }}>
                      <span className="w-7 shrink-0 font-semibold tabular-nums text-muted">{idx + 1}</span>
                      <span className="min-w-0 flex-1 sm:w-[var(--room)] sm:flex-none">
                        <span className={clsx("block break-words font-medium leading-tight", fit(widths.room))} title={b.room_name}>{b.room_name}</span>
                        <span className="block truncate text-xs text-muted sm:hidden">{b.event_title}</span>
                      </span>
                      <span className="hidden min-w-0 sm:block sm:w-[var(--event)] sm:flex-none">
                        <span className={clsx("block break-words font-medium leading-tight", fit(widths.event))} title={b.event_title}>{b.event_title}</span>
                        <span className="block truncate text-xs text-muted">{b.organization}</span>
                      </span>
                    </button>
                    {dayHeads.map((d) => (
                      <div key={d} className={clsx("min-h-11 border-l border-line/60", isWeekend(d) && "bg-weekend", d === todayCol && "!bg-gold-100/60")} style={{ gridRow: 1, gridColumn: d + 1 }} />
                    ))}
                    {segs.map((s, i) => (
                      <button key={i} onClick={() => setOpen(b.id)}
                        title={`${b.organization} · ${b.event_title} · ${b.room_name} · ${hours}`}
                        className={clsx("z-[1] mx-0.5 my-1.5 flex items-center overflow-hidden whitespace-nowrap px-1.5 text-left text-[11px] font-semibold text-white shadow-sm transition hover:brightness-110 hover:ring-2 hover:ring-offset-1",
                          "rounded-md", i === 0 && before && "rounded-l-none", i === segs.length - 1 && after && "rounded-r-none")}
                        style={{ gridRow: 1, gridColumn: `${s.start + 1} / ${s.end + 2}`, background: color }}>
                        {i === 0 && before && "‹ "}
                        {s.end - s.start >= 2 ? <span className="truncate">{hours} · {b.event_title}</span> : s.end - s.start >= 1 ? <span className="truncate">{hours}</span> : null}
                        {i === segs.length - 1 && after && <span className="ml-auto">›</span>}
                      </button>
                    ))}
                    {showActions && (
                      <div className="no-print sticky right-0 z-10 flex items-center justify-center gap-0.5 bg-surface px-1 shadow-[-1px_0_0_var(--line)] group-hover:bg-canvas" style={{ gridRow: 1, gridColumn: n + 2 }}>
                        {canEdit(b) && b.status === "confirmed" && (
                          <Link href={`/kiritish?edit=${b.id}`} className="rounded-md p-1.5 text-brand-800 hover:bg-brand-50 dark:text-brand-100 dark:hover:bg-brand-950" title="Таҳрирлаш" aria-label={`№${idx + 1} бронни таҳрирлаш`}>
                            <Pencil className="size-4" />
                          </Link>
                        )}
                        {viewer.isSuperAdmin ? (
                          <button onClick={() => setOpen(b.id, "delete")} className="rounded-md p-1.5 text-danger hover:bg-red-50 dark:hover:bg-red-950" title="Ўчириш" aria-label={`№${idx + 1} бронни ўчириш`}>
                            <Trash2 className="size-4" />
                          </button>
                        ) : canEdit(b) && b.status === "confirmed" ? (
                          <button onClick={() => setOpen(b.id, "cancel")} className="rounded-md p-1.5 text-danger hover:bg-red-50 dark:hover:bg-red-950" title="Бекор қилиш" aria-label={`№${idx + 1} бронни бекор қилиш`}>
                            <Ban className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            rooms.filter((r) => !roomFilter || r.id === roomFilter).map((r) => {
              const rb = filtered.filter((b) => b.room_id === r.id);
              return (
                <div key={r.id} className="grid border-b border-line text-sm last:border-b-0" style={{ gridTemplateColumns: cols }}>
                  <div className="sticky left-0 z-10 flex items-center gap-2 bg-surface px-2 py-1.5 shadow-[1px_0_0_var(--line)]">
                    <span className={clsx("size-2 shrink-0 rounded-full", r.kind === "hall" ? "bg-gold-500" : r.kind === "computer" ? "bg-brand-700" : "bg-emerald-600")} />
                    <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                    <span className="text-xs text-muted">{r.capacity}</span>
                    <span className="hidden text-xs text-muted lg:inline">· {rb.length} брон</span>
                  </div>
                  {dayHeads.map((d) => {
                    const on = rb.filter((b) => occupiedDays(b.slots, year, month).has(d));
                    const free = on.length === 0;
                    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    return (
                      <div key={d} className={clsx("flex min-h-11 flex-col justify-center gap-0.5 border-l border-line/60 p-0.5", isWeekend(d) && "bg-weekend", d === todayCol && "!bg-gold-100/60")}>
                        {on.slice(0, 3).map((b) => (
                          <button key={b.id} onClick={() => setOpen(b.id)} className="h-2.5 w-full rounded-sm hover:ring-2 hover:ring-offset-1" style={{ background: bookingColor(b) }}
                            title={`${b.organization} · ${slotsOnDay(b.slots, year, month, d).join(", ")}`} aria-label={`${b.organization}, ${d}-кун`} />
                        ))}
                        {on.length > 3 && <span className="text-center text-[9px] text-muted">+{on.length - 3}</span>}
                        {free && viewer.isAdmin && (
                          <Link href={`/kiritish?room=${r.id}&date=${dateStr}`} className="no-print h-full w-full rounded-sm opacity-0 hover:bg-brand-50 hover:opacity-100 focus:opacity-100 dark:hover:bg-brand-950" aria-label={`${r.name}, ${d}-кун: брон қилиш`}>
                            <span className="block text-center text-xs text-brand-800">+</span>
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>

      {view === "rooms" && (
        <p className="flex items-center gap-2 px-1 text-xs text-muted">
          <CalendarDays className="size-4" /> Ҳар бир чизиқча — шу кундаги битта брон. Бўш катакни босиб тез брон қилиш мумкин (админлар учун).
        </p>
      )}

      <BookingDrawer booking={open} viewer={viewer} startWith={startWith} onClose={() => setOpen(null)} />
    </div>
  );
}

function Empty({ canAdd }: { canAdd: boolean }) {
  return (
    <div className="px-4 py-14 text-center">
      <p className="font-medium">Бу ойда брон йўқ.</p>
      {canAdd && <Link href="/kiritish" className="btn btn-primary mt-4">Брон киритиш</Link>}
    </div>
  );
}


/** Тор устунда шрифт кичраяди, матн эса кейинги қаторга ўтиб тўлиқ кўринади */
function fit(w: number): string {
  return w < 130 ? "text-[11px]" : w < 190 ? "text-xs" : "text-sm";
}

// ── Устун кенглиги: сичқонча/бармоқ билан суриш, браузерда эслаб қолинади ──
type Widths = { room: number; event: number };
const DEFAULT_WIDTHS: Widths = { room: 176, event: 260 };
const WIDTHS_KEY = "korish-col-widths";
const clampW = (n: number) => Math.min(600, Math.max(90, Math.round(n)));

function useColumnWidths(): [Widths, (w: Widths) => void] {
  const [w, setW] = useState<Widths>(DEFAULT_WIDTHS);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(WIDTHS_KEY) ?? "null");
      if (v && typeof v.room === "number" && typeof v.event === "number") setW({ room: clampW(v.room), event: clampW(v.event) });
    } catch { /* сақланмаган */ }
  }, []);
  const set = (next: Widths) => {
    setW(next);
    try { localStorage.setItem(WIDTHS_KEY, JSON.stringify(next)); } catch { /* жим */ }
  };
  return [w, set];
}

function Resizer({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  return (
    <span
      role="separator" aria-orientation="vertical" aria-label={`${label} устуни кенглиги`} aria-valuenow={value} aria-valuemin={90} aria-valuemax={600}
      tabIndex={0} title="Суриб кенглигини ўзгартиринг (икки марта босиш — асл ҳолат)"
      className="no-print absolute -right-2 top-[-8px] bottom-[-8px] hidden w-3 cursor-col-resize touch-none select-none sm:block after:absolute after:inset-y-1 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded after:bg-line hover:after:bg-brand-700 focus-visible:after:bg-brand-700"
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.clientX, w: value }; }}
      onPointerMove={(e) => { if (start.current) onChange(clampW(start.current.w + e.clientX - start.current.x)); }}
      onPointerUp={() => { start.current = null; }}
      onPointerCancel={() => { start.current = null; }}
      onDoubleClick={() => onChange(label === "Тадбир" ? DEFAULT_WIDTHS.event : DEFAULT_WIDTHS.room)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") { e.preventDefault(); onChange(clampW(value - 16)); }
        if (e.key === "ArrowRight") { e.preventDefault(); onChange(clampW(value + 16)); }
      }}
    />
  );
}
