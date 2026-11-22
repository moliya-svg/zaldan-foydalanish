"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, FileText, ImageIcon, Loader2, Trash2, Upload, X } from "lucide-react";
import { saveBooking, checkAvailability, deleteBookingFile, type Conflict, type FileLink } from "@/lib/actions";
import { prepareFile, uploadBookingFiles, fmtSize } from "@/lib/upload";
import { maskPhoneInput, formatPhone } from "@/lib/phone";
import { fmtDateTime } from "@/lib/dates";
import { PALETTE } from "@/lib/colors";
import type { Room, TimeMode } from "@/lib/types";

export interface FormValues {
  room_id: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  time_mode: TimeMode;
  skip_weekends: boolean;
  organization: string;
  event_title: string;
  contact_name: string;
  contact_phone: string;
  note: string;
  attendees: string;
  color: string;
}

const EVENT_TYPES = ["Семинар", "Ўқув курси", "Мажлис", "Конференция", "Тренинг", "Имтиҳон", "Давра суҳбати"];

function groupRooms(rooms: Room[]) {
  const groups: { label: string; rooms: Room[] }[] = [{ label: "Мажлислар заллари", rooms: rooms.filter((r) => r.kind === "hall") }];
  const floors = [...new Set(rooms.filter((r) => r.kind !== "hall").map((r) => r.floor ?? 0))].sort();
  for (const f of floors) groups.push({ label: `${f}-қават`, rooms: rooms.filter((r) => r.kind !== "hall" && (r.floor ?? 0) === f) });
  return groups.filter((g) => g.rooms.length);
}

type PendingFile = { file: File; kind: "pdf" | "jpeg"; preview?: string };

export function BookingForm({
  rooms, initial, editId, userId, existingFiles = [], organizations = [],
}: {
  rooms: Room[];
  initial: FormValues;
  editId?: string;
  userId: string;
  existingFiles?: FileLink[];
  organizations?: string[];
}) {
  const router = useRouter();
  const [v, setV] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "error" | "ok"; text: string; id?: string } | null>(null);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [existing, setExisting] = useState<FileLink[]>(existingFiles);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avail, setAvail] = useState<{ conflicts: Conflict[]; free: { id: string; name: string; capacity: number }[] } | null>(null);
  const [checking, startCheck] = useTransition();
  const topRef = useRef<HTMLFormElement>(null);

  const room = rooms.find((r) => r.id === v.room_id);
  const groups = useMemo(() => groupRooms(rooms.filter((r) => r.is_active)), [rooms]);
  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  // Жонли бандлик текшируви (300 мс кечикиш билан)
  useEffect(() => {
    const { start_date, start_time, end_date, end_time } = v;
    if (!start_date || !start_time || !end_date || !end_time) { setAvail(null); return; }
    if (end_date < start_date) { setAvail(null); return; }
    const t = setTimeout(() => {
      startCheck(async () => {
        const r = await checkAvailability({
          room_id: v.room_id, start_date, start_time, end_date, end_time,
          time_mode: v.time_mode, skip_weekends: v.skip_weekends, exclude: editId,
        });
        if (!r.error) setAvail({ conflicts: r.conflicts, free: r.freeRooms });
      });
    }, 300);
    return () => clearTimeout(t);
  }, [v.room_id, v.start_date, v.start_time, v.end_date, v.end_time, v.time_mode, v.skip_weekends, editId]);

  async function addFiles(list: FileList | null, kind: "pdf" | "jpeg") {
    setFileError(null);
    if (!list) return;
    const current = files.filter((f) => f.kind === kind).length + existing.filter((f) => f.kind === kind).length;
    const incoming = [...list].slice(0, Math.max(0, 3 - current));
    if (incoming.length < list.length) setFileError("Ҳар бир устунга кўпи билан 3 та файл.");
    const prepared: PendingFile[] = [];
    for (const f of incoming) {
      try {
        const file = await prepareFile(f, kind);
        prepared.push({ file, kind, preview: kind === "jpeg" ? URL.createObjectURL(file) : undefined });
      } catch (e) {
        setFileError((e as Error).message);
      }
    }
    setFiles((p) => [...p, ...prepared]);
  }

  async function removeExisting(id: string) {
    const r = await deleteBookingFile(id);
    if (r.ok) setExisting((p) => p.filter((f) => f.id !== id));
    else setFileError(r.message ?? "Файл ўчирилмади");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await saveBooking(v, editId);
    if (!res.ok) {
      setSaving(false);
      setErrors(res.fieldErrors ?? {});
      setMessage({ type: "error", text: res.message });
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    let uploadErrors: string[] = [];
    if (files.length) uploadErrors = await uploadBookingFiles(res.id, files, userId);
    files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    setSaving(false);
    setFiles([]);
    if (editId) {
      router.push(`/korish?open=${res.id}`);
      return;
    }
    setMessage({
      type: uploadErrors.length ? "error" : "ok",
      text: uploadErrors.length ? `Брон сақланди, лекин баъзи файллар юкланмади: ${uploadErrors.join("; ")}` : "Брон сақланди.",
      id: res.id,
    });
    setV((p) => ({ ...initial, room_id: p.room_id, time_mode: p.time_mode }));
    setAvail(null);
    router.refresh();
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const conflicts = avail?.conflicts ?? [];
  const over = room && v.attendees && Number(v.attendees) > room.capacity;

  return (
    <form onSubmit={submit} noValidate className="space-y-4" ref={topRef}>
      {message && (
        <div role="status" className={clsx("flex items-start gap-3 rounded-xl px-4 py-3 text-sm", message.type === "ok" ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100")}>
          {message.type === "ok" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" />}
          <div className="flex-1">
            {message.text}{" "}
            {message.id && <Link className="font-semibold underline" href={`/korish?open=${message.id}`}>Календарда кўриш</Link>}
          </div>
          <button type="button" aria-label="Ёпиш" onClick={() => setMessage(null)}><X className="size-4" /></button>
        </div>
      )}

      {/* Вақт режими */}
      <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <span className="text-sm font-semibold">Вақт режими:</span>
        <div className="inline-flex rounded-lg border border-line p-1" role="radiogroup" aria-label="Вақт режими">
          {([["daily", "Ҳар куни шу соатларда"], ["continuous", "Узлуксиз"]] as const).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={v.time_mode === k} onClick={() => set("time_mode", k)}
              className={clsx("rounded-md px-3 py-1.5 text-sm font-medium", v.time_mode === k ? "bg-brand-900 text-white" : "text-muted hover:bg-canvas")}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          {v.time_mode === "daily"
            ? "Масалан: 24–28 ноябр, ҳар куни 09:00–13:00. Қолган соатларда хона бошқалар учун бўш."
            : "Масалан: 24 ноябр 09:00 дан 26 ноябр 18:00 гача тўхтовсиз банд."}
        </p>
        {v.time_mode === "daily" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-brand-900" checked={v.skip_weekends} onChange={(e) => set("skip_weekends", e.target.checked)} />
            Шанба ва якшанбани ўтказиб юбориш
          </label>
        )}
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1fr_340px]">
        {/* 12 та алоҳида устун */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Cell n={1} label="Зал / хона" error={errors.room_id} className="xl:col-span-2">
            <select className="field-input" required value={v.room_id} onChange={(e) => set("room_id", e.target.value)} aria-invalid={!!errors.room_id}>
              <option value="">— танланг —</option>
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} · {r.capacity} ўрин</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {room?.capacity_alt && <p className="mt-1 text-xs text-muted">{room.capacity_alt}</p>}
          </Cell>
          <Cell n={2} label="Бошланиш санаси" error={errors.start_date}>
            <input type="date" className="field-input" required value={v.start_date} onChange={(e) => { set("start_date", e.target.value); if (!v.end_date || v.end_date < e.target.value) set("end_date", e.target.value); }} aria-invalid={!!errors.start_date} />
          </Cell>
          <Cell n={3} label="Бошланиш соати" error={errors.start_time}>
            <input type="time" step={900} min="07:00" max="22:00" className="field-input" required value={v.start_time} onChange={(e) => set("start_time", e.target.value)} aria-invalid={!!errors.start_time} />
          </Cell>
          <Cell n={4} label="Тугаш санаси" error={errors.end_date}>
            <input type="date" className="field-input" required min={v.start_date} value={v.end_date} onChange={(e) => set("end_date", e.target.value)} aria-invalid={!!errors.end_date} />
          </Cell>
          <Cell n={5} label="Тугаш соати" error={errors.end_time}>
            <input type="time" step={900} min="07:00" max="23:00" className="field-input" required value={v.end_time} onChange={(e) => set("end_time", e.target.value)} aria-invalid={!!errors.end_time} />
          </Cell>

          <Cell n={6} label="Банд қилган ташкилот номи" error={errors.organization} className="xl:col-span-2">
            <input className="field-input" required maxLength={200} list="orgs" placeholder="Масалан: Молия вазирлиги" value={v.organization} onChange={(e) => set("organization", e.target.value)} aria-invalid={!!errors.organization} />
            <datalist id="orgs">{organizations.map((o) => <option key={o} value={o} />)}</datalist>
          </Cell>
          <Cell n={7} label="Нима тадбир" error={errors.event_title} className="xl:col-span-2">
            <input className="field-input" required maxLength={200} list="events" placeholder="Семинар, ўқув курси…" value={v.event_title} onChange={(e) => set("event_title", e.target.value)} aria-invalid={!!errors.event_title} />
            <datalist id="events">{EVENT_TYPES.map((o) => <option key={o} value={o} />)}</datalist>
          </Cell>
          <Cell n={8} label="Банд қилган Ф.И.Ш. (ихтиёрий)" error={errors.contact_name} className="xl:col-span-2">
            <input className="field-input" maxLength={120} autoComplete="name" placeholder="Фамилия Исм Шарифи" value={v.contact_name} onChange={(e) => set("contact_name", e.target.value)} aria-invalid={!!errors.contact_name} />
          </Cell>

          <Cell n={9} label="Телефон рақами (ихтиёрий)" error={errors.contact_phone} className="xl:col-span-2">
            <input className="field-input" inputMode="tel" autoComplete="tel" placeholder="+998 (__) ___-__-__" value={v.contact_phone} onChange={(e) => set("contact_phone", maskPhoneInput(e.target.value))} aria-invalid={!!errors.contact_phone} />
          </Cell>
          <Cell n={10} label="Изоҳ" error={errors.note} className="xl:col-span-4">
            <textarea className="field-input min-h-[42px]" rows={1} maxLength={1000} placeholder="Қўшимча маълумот (ихтиёрий)" value={v.note} onChange={(e) => set("note", e.target.value)} />
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
              <label className="flex items-center gap-1">
                Иштирокчилар:
                <input type="number" min={1} className="field-input !min-h-0 w-20 !py-1" value={v.attendees} onChange={(e) => set("attendees", e.target.value)} />
              </label>
              {over && <span className="text-danger">Хона сиғими {room!.capacity} ўрин</span>}
              <span className="ml-auto flex items-center gap-1">
                Ранг:
                <button type="button" onClick={() => set("color", "")} className={clsx("rounded px-1.5 py-0.5 border border-line", !v.color && "ring-2 ring-brand-700")}>авто</button>
                {PALETTE.map((c) => (
                  <button key={c} type="button" aria-label={`Ранг ${c}`} onClick={() => set("color", c)} className={clsx("size-5 rounded-full", v.color === c && "ring-2 ring-offset-1 ring-brand-900")} style={{ background: c }} />
                ))}
              </span>
            </div>
          </Cell>

          <FileCell n={11} label="PDF ҳужжат" hint="Хат, буйруқ, шартнома · 10 MB гача" kind="pdf" accept="application/pdf,.pdf"
            files={files.filter((f) => f.kind === "pdf")} existing={existing.filter((f) => f.kind === "pdf")}
            onAdd={(l) => addFiles(l, "pdf")} onRemove={(f) => setFiles((p) => p.filter((x) => x !== f))} onRemoveExisting={removeExisting} className="xl:col-span-3" />
          <FileCell n={12} label="JPEG расм" hint="Скан, тасдиқ, афиша · автомат сиқилади" kind="jpeg" accept="image/jpeg,image/png,image/webp"
            files={files.filter((f) => f.kind === "jpeg")} existing={existing.filter((f) => f.kind === "jpeg")}
            onAdd={(l) => addFiles(l, "jpeg")} onRemove={(f) => { if (f.preview) URL.revokeObjectURL(f.preview); setFiles((p) => p.filter((x) => x !== f)); }} onRemoveExisting={removeExisting} className="xl:col-span-3" />
          {fileError && <p role="alert" className="text-sm text-danger sm:col-span-2 lg:col-span-3 xl:col-span-6">{fileError}</p>}
        </div>

        {/* Бандлик панели */}
        <aside className="card h-fit p-4 2xl:sticky 2xl:top-4" aria-live="polite">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            Бандлик текшируви {checking && <Loader2 className="size-4 animate-spin text-muted" />}
          </h3>
          {!avail && <p className="text-sm text-muted">Сана ва соатни танланг — тизим шу заҳоти текширади.</p>}
          {avail && v.room_id && conflicts.length === 0 && (
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              <CheckCircle2 className="size-4" /> {room?.name} бу вақтда бўш.
            </p>
          )}
          {conflicts.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-danger"><AlertTriangle className="size-4" /> {room?.name} банд:</p>
              {conflicts.slice(0, 4).map((c) => (
                <div key={c.booking_id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-950 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
                  <b>№{c.seq_no} {c.organization}</b> — {c.event_title}<br />
                  {fmtDateTime(c.slot_start)} – {fmtDateTime(c.slot_end)}
                </div>
              ))}
            </div>
          )}
          {avail && (conflicts.length > 0 || !v.room_id) && avail.free.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Шу вақтда бўш</p>
              <div className="flex flex-wrap gap-1.5">
                {avail.free.slice(0, 14).map((r) => (
                  <button key={r.id} type="button" onClick={() => set("room_id", r.id)} className="rounded-full border border-line px-2.5 py-1 text-xs hover:border-brand-700 hover:bg-brand-50 dark:hover:bg-brand-950">
                    {r.name} · {r.capacity}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary min-w-48" disabled={saving || conflicts.length > 0}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          {editId ? "Ўзгаришларни сақлаш" : "Бронни сақлаш"}
        </button>
        {editId && <Link href={`/korish?open=${editId}`} className="btn btn-ghost">Бекор қилиш</Link>}
        {v.contact_phone && v.contact_phone.replace(/\D/g, "").length === 12 && (
          <span className="text-xs text-muted">Телефон: {formatPhone("+" + v.contact_phone.replace(/\D/g, ""))}</span>
        )}
      </div>
    </form>
  );
}

function Cell({ n, label, error, className, children }: { n: number; label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={clsx("card flex flex-col overflow-hidden", error && "border-danger", className)}>
      <div className="flex items-center gap-2 border-b border-line bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-900 dark:bg-brand-950 dark:text-brand-100">
        <span className="grid size-5 place-items-center rounded-full bg-brand-900 text-[10px] text-white">{n}</span>
        {label}
      </div>
      <div className="flex-1 p-2.5">
        {children}
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}

function FileCell({
  n, label, hint, kind, accept, files, existing, onAdd, onRemove, onRemoveExisting, className,
}: {
  n: number; label: string; hint: string; kind: "pdf" | "jpeg"; accept: string;
  files: PendingFile[]; existing: FileLink[];
  onAdd: (l: FileList | null) => void; onRemove: (f: PendingFile) => void; onRemoveExisting: (id: string) => void;
  className?: string;
}) {
  const [drag, setDrag] = useState(false);
  const Icon = kind === "pdf" ? FileText : ImageIcon;
  return (
    <Cell n={n} label={label} className={className}>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onAdd(e.dataTransfer.files); }}
        className={clsx("flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-3 py-3 text-sm transition", drag ? "border-brand-700 bg-brand-50 dark:bg-brand-950" : "border-line hover:border-brand-700")}
      >
        <Upload className="size-5 text-brand-800" />
        <span><b>Файл танланг</b> ёки шу ерга ташланг<br /><span className="text-xs text-muted">{hint}</span></span>
        <input type="file" className="sr-only" accept={accept} multiple onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }} />
      </label>
      {(existing.length > 0 || files.length > 0) && (
        <ul className="mt-2 space-y-1.5">
          {existing.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-md bg-canvas px-2 py-1.5 text-xs">
              <Icon className="size-4 shrink-0 text-brand-800" />
              <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 truncate underline">{f.name}</a>
              <span className="text-muted">{fmtSize(f.size)}</span>
              <button type="button" aria-label="Ўчириш" onClick={() => onRemoveExisting(f.id)}><Trash2 className="size-4 text-danger" /></button>
            </li>
          ))}
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md bg-canvas px-2 py-1.5 text-xs">
              {f.preview ? <img src={f.preview} alt="" className="size-8 rounded object-cover" /> : <Icon className="size-4 shrink-0 text-brand-800" />}
              <span className="flex-1 truncate">{f.file.name}</span>
              <span className="text-muted">{fmtSize(f.file.size)}</span>
              <button type="button" aria-label="Олиб ташлаш" onClick={() => onRemove(f)}><X className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </Cell>
  );
}
