"use client";
import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

/** ISO (йил-ой-кун) → кун.ой.йил */
export function isoToDmy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/** кун.ой.йил → ISO; нотўғри сана бўлса null */
export function dmyToIso(dmy: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dmy.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Ёзилаётган рақамларга нуқта қўйиш: 22112026 → 22.11.2026 */
export function maskDmy(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join(".");
}

type Props = {
  value: string; // ISO
  onChange: (iso: string) => void;
  min?: string;
  required?: boolean;
  invalid?: boolean;
  label?: string;
};

/** Браузер тилидан қатъи назар доим кун.ой.йил кўринишидаги сана майдони */
export function DateField({ value, onChange, min, required, invalid, label }: Props) {
  const [text, setText] = useState(isoToDmy(value));
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => { setText(isoToDmy(value)); }, [value]);

  function commit(t: string) {
    const iso = dmyToIso(t);
    if (iso) onChange(iso);
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        placeholder="кк.оо.йййй"
        className="field-input pr-10 tabular-nums"
        required={required}
        aria-label={label}
        aria-invalid={invalid}
        pattern="\d{2}\.\d{2}\.\d{4}"
        value={text}
        onChange={(e) => { const t = maskDmy(e.target.value); setText(t); if (t.length === 10) commit(t); }}
        onBlur={() => { if (!dmyToIso(text)) setText(isoToDmy(value)); }}
      />
      <button
        type="button"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-ink"
        aria-label="Календардан танлаш"
        title="Календардан танлаш"
        onClick={() => { const el = picker.current; if (!el) return; try { el.showPicker(); } catch { el.focus(); el.click(); } }}
      >
        <CalendarDays className="size-4" />
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        min={min}
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
    </div>
  );
}

/** 24 соатлик вақт танлаш (15 дақиқа қадам) */
export function TimeField({ value, onChange, from = "07:00", to = "23:00", invalid, label }: {
  value: string; onChange: (v: string) => void; from?: string; to?: string; invalid?: boolean; label?: string;
}) {
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const opts: string[] = [];
  for (let m = toMin(from); m <= toMin(to); m += 15) opts.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  if (value && !opts.includes(value)) opts.unshift(value);
  return (
    <select className="field-input tabular-nums" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} aria-label={label} required>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
