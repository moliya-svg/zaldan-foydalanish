/** Тошкент вақти: UTC+5, ёзги вақт йўқ. Барча ҳисоблар шу бўйича. */
export const TZ_OFFSET_MIN = 5 * 60;
const OFFSET_MS = TZ_OFFSET_MIN * 60_000;
const DAY_MS = 86_400_000;

export const MONTHS = [
  "Январ", "Феврал", "Март", "Апрел", "Май", "Июн",
  "Июл", "Август", "Сентябр", "Октябр", "Ноябр", "Декабр",
];
export const MONTHS_SHORT = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
export const WEEKDAYS_SHORT = ["Дш", "Сш", "Чш", "Пш", "Жм", "Шн", "Як"];

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO → Тошкентдаги "сохта UTC" Date (getUTC* методлари маҳаллий қийматни беради) */
function shifted(iso: string | Date): Date {
  const t = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  return new Date(t + OFFSET_MS);
}

export function tkParts(iso: string | Date) {
  const d = shifted(iso);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: d.getUTCHours(), mi: d.getUTCMinutes(), dow: (d.getUTCDay() + 6) % 7 };
}

export function tkDate(iso: string | Date): string {
  const p = tkParts(iso);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function tkTime(iso: string | Date): string {
  const p = tkParts(iso);
  return `${pad(p.hh)}:${pad(p.mi)}`;
}

export function fmtDate(iso: string | Date): string {
  const p = tkParts(iso);
  return `${pad(p.d)}.${pad(p.m)}.${p.y}`;
}

export function fmtDateTime(iso: string | Date): string {
  return `${fmtDate(iso)}, ${tkTime(iso)}`;
}

/** "2026-11-24" + "09:00" → ISO Тошкент вақти билан */
export function toIso(date: string, time: string): string {
  return `${date}T${time}:00+05:00`;
}

/** Ойнинг Тошкент бўйича бошланиши ва кейинги ойнинг бошланиши (ISO) */
export function monthRange(y: number, m: number): { from: string; to: string } {
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return { from: `${y}-${pad(m)}-01T00:00:00+05:00`, to: `${ny}-${pad(nm)}-01T00:00:00+05:00` };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 0 = душанба … 6 = якшанба */
export function weekday(y: number, m: number, d: number): number {
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function todayTk(): { y: number; m: number; d: number } {
  const p = tkParts(new Date());
  return { y: p.y, m: p.m, d: p.d };
}

/** Слотлар берилган ойнинг қайси кунларини эгаллайди (1..31) */
export function occupiedDays(slots: [string, string][], y: number, m: number): Set<number> {
  const out = new Set<number>();
  for (const [a, b] of slots) {
    const start = Date.parse(a) + OFFSET_MS;
    const end = Date.parse(b) + OFFSET_MS - 1; // [a, b) — тугаш эксклюзив
    let dayStart = Math.floor(start / DAY_MS) * DAY_MS;
    while (dayStart <= end) {
      const d = new Date(dayStart);
      if (d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m) out.add(d.getUTCDate());
      dayStart += DAY_MS;
    }
  }
  return out;
}

/** Кетма-кет кунларни полосаларга бирлаштириш */
export function toSegments(days: Set<number>): { start: number; end: number }[] {
  const sorted = [...days].sort((a, b) => a - b);
  const segs: { start: number; end: number }[] = [];
  for (const d of sorted) {
    const last = segs[segs.length - 1];
    if (last && last.end === d - 1) last.end = d;
    else segs.push({ start: d, end: d });
  }
  return segs;
}

/** Бир кундаги слотлар соатлари ("09:00–13:00") */
export function slotsOnDay(slots: [string, string][], y: number, m: number, d: number): string[] {
  const key = `${y}-${pad(m)}-${pad(d)}`;
  const res: string[] = [];
  for (const [a, b] of slots) {
    const da = tkDate(a);
    const db = tkDate(new Date(Date.parse(b) - 1));
    if (key < da || key > db) continue;
    const from = key === da ? tkTime(a) : "00:00";
    const to = key === db ? tkTime(b) : "24:00";
    res.push(`${from}–${to === "00:00" ? "24:00" : to}`);
  }
  return res;
}

/** Жами банд соатлар */
export function totalHours(slots: [string, string][]): number {
  const ms = slots.reduce((s, [a, b]) => s + (Date.parse(b) - Date.parse(a)), 0);
  return Math.round((ms / 3_600_000) * 10) / 10;
}

export function isNow(slots: [string, string][], now = Date.now()): boolean {
  return slots.some(([a, b]) => Date.parse(a) <= now && now < Date.parse(b));
}
