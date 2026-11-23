"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { X, Building2, CalendarClock, Landmark, User, Phone, MessageSquare, Paperclip, Pencil, Copy, Ban, Trash2, Loader2, CalendarPlus, FileText, ImageIcon, Download } from "lucide-react";
import { bookingColor } from "@/lib/colors";
import { fmtDateTime, tkTime, totalHours, fmtDate } from "@/lib/dates";
import { getBookingFiles, cancelBooking, deleteBooking, type FileLink } from "@/lib/actions";
import { fmtSize } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { Booking, Viewer } from "@/lib/types";

function icsFor(b: Booking): string {
  const z = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const events = b.slots.map(([a, e], i) => [
    "BEGIN:VEVENT", `UID:${b.id}-${i}@zal`, `DTSTAMP:${z(new Date().toISOString())}`, `DTSTART:${z(a)}`, `DTEND:${z(e)}`,
    `SUMMARY:${esc(`${b.event_title} — ${b.room_name}`)}`, `DESCRIPTION:${esc([b.event_topic && `Мавзу: ${b.event_topic}`, b.organization, b.contact_name].filter(Boolean).join("\n"))}`, `LOCATION:${esc(b.room_name)}`, "END:VEVENT",
  ].join("\r\n"));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ukuv markazi//Bron//UZ", ...events, "END:VCALENDAR"].join("\r\n");
}

export function BookingDrawer({ booking: b, viewer, onClose, startWith = null }: { booking: Booking | null; viewer: Viewer; onClose: () => void; startWith?: "cancel" | "delete" | null }) {
  const router = useRouter();
  const [files, setFiles] = useState<FileLink[] | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setFiles(null); setConfirm(startWith); setReason(""); setError(null);
    if (b && viewer.isAdmin) getBookingFiles(b.id).then(setFiles);
    if (b) closeRef.current?.focus();
  }, [b, viewer.isAdmin, startWith]);

  useEffect(() => {
    if (!b) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [b, onClose]);

  if (!b) return null;
  const color = bookingColor(b);
  const canEdit = viewer.canManageAll || (viewer.isAdmin && b.created_by === viewer.id);
  const days = new Set(b.slots.map(([a]) => fmtDate(a))).size;

  function run(kind: "cancel" | "delete") {
    setError(null);
    start(async () => {
      const r = kind === "cancel" ? await cancelBooking(b!.id, reason) : await deleteBooking(b!.id);
      if (!r.ok) { setError(r.message ?? "Хатолик"); return; }
      onClose();
      router.refresh();
    });
  }

  function downloadIcs() {
    const url = URL.createObjectURL(new Blob([icsFor(b!)], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url; a.download = `bron-${b!.seq_no}.ics`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 no-print" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="absolute inset-0 bg-brand-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86vh] sm:w-[min(620px,calc(100vw-48px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-hidden sm:overflow-y-auto sm:rounded-2xl sm:border sm:border-line">
        <div className="h-2" style={{ background: color }} />
        <div className="flex items-start gap-3 p-5 pb-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Брон №{b.seq_no}{b.status === "cancelled" && " · бекор қилинган"}</p>
            <h2 id="drawer-title" className="mt-1 text-xl font-bold leading-snug">{b.event_title}</h2>
            {b.event_topic && <p className="mt-1 text-sm leading-snug text-muted"><span className="font-semibold">Мавзу:</span> {b.event_topic}</p>}
          </div>
          <button ref={closeRef} onClick={onClose} className="rounded-lg p-2 hover:bg-canvas" aria-label="Ёпиш"><X className="size-5" /></button>
        </div>

        <dl className="space-y-4 px-5 text-sm sm:px-6">
          <Row icon={<Building2 />} label="Зал / хона">{b.room_name}{b.attendees ? ` · ${b.attendees} иштирокчи` : ""}</Row>
          <Row wide icon={<CalendarClock />} label="Вақти">
            <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2">
              <span className="text-muted">Бошланиши:</span>
              <span className="font-semibold tabular-nums">{fmtDate(b.starts_at)} <span className="ml-2 text-muted">соат</span> {tkTime(b.starts_at)}</span>
              <span className="text-muted">Тугаши:</span>
              <span className="font-semibold tabular-nums">{fmtDate(b.ends_at)} <span className="ml-2 text-muted">соат</span> {tkTime(b.ends_at)}</span>
            </div>
            <div className="mt-2 text-muted">
              {b.time_mode === "daily" ? `Ҳар куни ${tkTime(b.slots[0]?.[0] ?? b.starts_at)}–${tkTime(b.slots[0]?.[1] ?? b.ends_at)}` : "Узлуксиз"}
              {b.skip_weekends && ", дам олиш кунларисиз"} · {days} кун · жами {totalHours(b.slots)} соат
            </div>
            {b.time_mode === "daily" && b.slots.length > 1 && (
              <details className="mt-1 text-xs">
                <summary className="cursor-pointer text-brand-800 dark:text-brand-100">Кунлар рўйхати ({b.slots.length})</summary>
                <ul className="mt-1 grid grid-cols-2 gap-x-3">
                  {b.slots.map(([a, e]) => <li key={a}>{fmtDate(a)} · {tkTime(a)}–{tkTime(e)}</li>)}
                </ul>
              </details>
            )}
          </Row>
          <Row icon={<Landmark />} label="Ташкилот">{b.organization}</Row>
          {b.contact_name && <Row icon={<User />} label="Банд қилган Ф.И.Ш.">{b.contact_name}</Row>}
          {b.contact_phone && (
            <Row icon={<Phone />} label="Телефон">
              {viewer.isAdmin ? <a className="font-medium text-brand-800 underline dark:text-brand-100" href={`tel:${b.contact_phone}`}>{formatPhone(b.contact_phone)}</a> : b.contact_phone}
            </Row>
          )}
          {b.note && <Row wide icon={<MessageSquare />} label="Изоҳ"><p className="whitespace-pre-wrap">{b.note}</p></Row>}
          {b.cancel_reason && <Row wide icon={<Ban />} label="Бекор қилиш сабаби">{b.cancel_reason}</Row>}
          {viewer.isAdmin && (
            <Row wide icon={<Paperclip />} label="Ҳужжатлар">
              {files === null ? <Loader2 className="size-4 animate-spin text-muted" /> : files.length === 0 ? <span className="text-muted">Файл юкланмаган</span> : (
                <ul className="space-y-2">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 rounded-lg border border-line p-2">
                      {f.kind === "jpeg"
                        ? <a href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt={f.name} className="size-12 rounded object-cover" /></a>
                        : <FileText className="size-8 text-danger" />}
                      <div className="min-w-0 flex-1">
                        <a href={f.url} target="_blank" rel="noreferrer" className="block truncate font-medium hover:underline">{f.name}</a>
                        <span className="text-xs text-muted">{f.kind === "pdf" ? "PDF" : "JPEG"} · {fmtSize(f.size)}</span>
                      </div>
                      <a href={f.url} download={f.name} className="rounded p-1.5 hover:bg-canvas" aria-label="Юклаб олиш">{f.kind === "pdf" ? <Download className="size-4" /> : <ImageIcon className="size-4" />}</a>
                    </li>
                  ))}
                </ul>
              )}
            </Row>
          )}
        </dl>

        <p className="mt-4 px-5 text-xs text-muted">
          {b.created_by_email ? `Киритган: ${b.created_by_name ? `${b.created_by_name} (${b.created_by_email})` : b.created_by_email} · ` : ""}{fmtDateTime(b.created_at)}
          {b.updated_at !== b.created_at && ` · ўзгартирилган: ${fmtDateTime(b.updated_at)}`}
        </p>

        <div className="sticky bottom-0 mt-4 space-y-3 border-t border-line bg-surface p-4">
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {confirm ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">{confirm === "cancel" ? "Бронни бекор қиласизми? Вақт бошқалар учун бўшайди." : "Бронни бутунлай ўчирасизми? Буни қайтариб бўлмайди."}</p>
              {confirm === "cancel" && <input className="field-input" placeholder="Сабаби (ихтиёрий)" value={reason} onChange={(e) => setReason(e.target.value)} />}
              <div className="flex gap-2">
                <button className="btn btn-danger flex-1" disabled={pending} onClick={() => run(confirm)}>{pending && <Loader2 className="size-4 animate-spin" />}Ҳа, {confirm === "cancel" ? "бекор қилиш" : "ўчириш"}</button>
                <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Йўқ</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {canEdit && b.status === "confirmed" && <Link href={`/kiritish?edit=${b.id}`} className="btn btn-primary flex-1"><Pencil className="size-4" />Таҳрирлаш</Link>}
              {viewer.isAdmin && <Link href={`/kiritish?copy=${b.id}`} className="btn btn-ghost" title="Шу брон асосида янгисини яратиш"><Copy className="size-4" />Нусха</Link>}
              <button onClick={downloadIcs} className="btn btn-ghost" title="Телефон календарига қўшиш"><CalendarPlus className="size-4" />.ics</button>
              {canEdit && b.status === "confirmed" && <button onClick={() => setConfirm("cancel")} className="btn btn-ghost text-danger"><Ban className="size-4" />Бекор қилиш</button>}
              {viewer.canManageAll && <button onClick={() => setConfirm("delete")} className="btn btn-ghost text-danger" aria-label="Ўчириш" title="Ўчириш"><Trash2 className="size-4" /></button>}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ icon, label, children, wide = false }: { icon: React.ReactElement; label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={clsx("flex gap-3", wide && "sm:col-span-2")}>
      <span className="mt-0.5 text-brand-800 dark:text-brand-100 [&>svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}
