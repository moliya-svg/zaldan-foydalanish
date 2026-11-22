"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { Building2, CalendarClock, User, Phone, StickyNote, Users, PenLine } from "lucide-react";
import { fmtDate, fmtDateTime, tkTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { bookingColor } from "@/lib/colors";
import type { Booking } from "@/lib/types";

export type Hover = { booking: Booking; x: number; y: number } | null;

/** Сичқонча рангли чизиқ устига келганда чиқадиган маълумот ойнаси */
export function BookingHoverCard({ hover }: { hover: Hover }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });

  useLayoutEffect(() => {
    if (!hover || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const gap = 16;
    let left = hover.x + gap;
    let top = hover.y + gap;
    if (left + width > window.innerWidth - 8) left = Math.max(8, hover.x - width - gap);
    if (top + height > window.innerHeight - 8) top = Math.max(8, hover.y - height - gap);
    setPos({ left, top });
  }, [hover]);

  if (!hover) return null;
  const b = hover.booking;
  const color = bookingColor(b);
  return (
    <div ref={ref} role="tooltip"
      className="pointer-events-none fixed z-50 w-[min(440px,calc(100vw-16px))] overflow-hidden rounded-xl border border-line bg-surface text-[15px] shadow-2xl"
      style={{ left: pos.left, top: pos.top }}>
      <div className="px-4 py-3 text-white" style={{ background: color }}>
        <div className="text-xs font-semibold opacity-90">№ {b.seq_no} · {b.organization}</div>
        <div className="mt-0.5 text-lg font-bold leading-snug">{b.event_title}</div>
        {b.event_topic && <div className="mt-0.5 text-sm leading-snug opacity-95"><span className="opacity-80">Мавзу:</span> {b.event_topic}</div>}
      </div>
      <dl className="space-y-2.5 px-4 py-3">
        <Line icon={<Building2 />} label="Зал / хона">{b.room_name}</Line>
        <Line icon={<CalendarClock />} label="Вақти">
          <div className="tabular-nums"><span className="text-muted">Бошланиши:</span> <b>{fmtDate(b.starts_at)}</b> <span className="text-muted">соат</span> <b>{tkTime(b.starts_at)}</b></div>
          <div className="tabular-nums"><span className="text-muted">Тугаши:</span> <b>{fmtDate(b.ends_at)}</b> <span className="text-muted">соат</span> <b>{tkTime(b.ends_at)}</b></div>
          {b.time_mode === "daily" && <div className="text-xs text-muted">Ҳар куни шу соатларда</div>}
        </Line>
        {b.contact_name && <Line icon={<User />} label="Ф.И.Ш.">{b.contact_name}</Line>}
        {b.contact_phone && <Line icon={<Phone />} label="Телефон">{formatPhone(b.contact_phone)}</Line>}
        {b.attendees ? <Line icon={<Users />} label="Иштирокчилар">{b.attendees} нафар</Line> : null}
        {b.note && <Line icon={<StickyNote />} label="Изоҳ"><span className="line-clamp-3">{b.note}</span></Line>}
        <Line icon={<PenLine />} label="Киритган">
          <span className="text-sm">{b.created_by_email ?? "—"} · <span className="tabular-nums text-muted">{fmtDateTime(b.created_at)}</span></span>
        </Line>
      </dl>
      <div className="border-t border-line bg-canvas px-4 py-1.5 text-xs text-muted">Батафсил ва амаллар учун босинг</div>
    </div>
  );
}

function Line({ icon, label, children }: { icon: React.ReactElement; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-muted [&>svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="break-words">{children}</dd>
      </div>
    </div>
  );
}
