"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldPlus, Lock, Unlock, KeyRound, Wand2, Eye, EyeOff, Pencil, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { setUserRole, setUserBlocked, setUserPassword, deleteUser } from "@/lib/actions";
import { ROLE_LABEL, ROLE_ORDER, type AssignableRole, type Role } from "@/lib/types";

export interface UserRow { id: string | null; email: string; full_name: string | null; role: Role; is_blocked: boolean; created_at: string | null; pending: boolean }

const ROLE_HINT: Record<AssignableRole, string> = {
  admin1: "Барча бронларни таҳрирлайди ва ўчиради",
  admin: "Фақат ўзи киритган бронларни таҳрирлайди",
  viewer: "Фақат кўради",
};

export function AdminManager({ rows, selfId }: { rows: UserRow[]; selfId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [addRole, setAddRole] = useState<Exclude<AssignableRole, "viewer">>("admin");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [pEmail, setPEmail] = useState("");
  const [pName, setPName] = useState("");
  const [pPass, setPPass] = useState("");
  const [pRole, setPRole] = useState<AssignableRole>("admin");
  const [showPass, setShowPass] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  function startEdit(r: UserRow) {
    setEditing(r.email);
    setPEmail(r.email);
    setPName(r.full_name ?? "");
    setPRole(r.role === "super_admin" ? "admin" : r.role);
    setPPass("");
    setMsg(null);
    document.getElementById("parol-berish")?.scrollIntoView({ behavior: "smooth" });
  }
  function stopEdit() {
    setEditing(null);
    setPEmail(""); setPName(""); setPPass("");
  }
  function remove(r: UserRow) {
    const who = r.full_name ? `${r.full_name} (${r.email})` : r.email;
    if (!window.confirm(`${who} ўчирилсинми?\n\nУ тизимга кира олмайди. Унинг киритган бронлари қолади. Буни ортга қайтариб бўлмайди.`)) return;
    if (editing === r.email) stopEdit();
    act(() => deleteUser(r.email), `${who} ўчирилди`);
  }

  function genPassword() {
    const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const arr = new Uint32Array(10);
    crypto.getRandomValues(arr);
    setPPass(Array.from(arr, (n) => abc[n % abc.length]).join(""));
    setShowPass(true);
  }

  const act = (fn: () => Promise<{ ok: boolean; message?: string }>, okText: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.message ?? "Хатолик" });
      if (r.ok) router.refresh();
    });

  const sorted = [...rows].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line p-4">
        <h2 className="mb-2 font-semibold">Админ қўшиш</h2>
        <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]" onSubmit={(e) => { e.preventDefault(); const em = email, nm = name, rl = addRole; act(() => setUserRole(em, rl, nm), `${em}: ${ROLE_LABEL[rl]} қилинди`); setEmail(""); setName(""); }}>
          <input type="email" required className="field-input" placeholder="e-mail манзил" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="field-input" maxLength={120} autoComplete="off" placeholder="Ф.И.Ш. (Фамилия Исм Шарифи)" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="field-input !w-auto" value={addRole} onChange={(e) => setAddRole(e.target.value as "admin1" | "admin")} aria-label="Рол" title={ROLE_HINT[addRole]}>
            <option value="admin">Админ</option>
            <option value="admin1">Админ-1</option>
          </select>
          <button className="btn btn-primary" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldPlus className="size-4" />}Админ қилиш</button>
        </form>
        <p className="mt-2 text-xs text-muted">Ҳали тизимга кирмаган e-mail ҳам қўшиш мумкин. У биринчи кирганда дарҳол админ бўлади. <b>Админ</b> фақат ўзи киритган бронларни таҳрирлайди, <b>Админ-1</b> эса барча бронларни таҳрирлайди ва ўчиради.</p>
      </div>
      <div id="parol-berish" className="border-b border-line p-4">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          {editing ? <>Таҳрирлаш: <span className="font-normal">{editing}</span>
            <button type="button" onClick={stopEdit} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-canvas"><X className="size-3.5" />Бекор қилиш</button></>
            : "Пароль бериш"}
        </h2>
        <p className="mb-2 text-xs text-muted">Фойдаланувчи почтага хат кутмасдан шу e-mail ва пароль билан киради. Ҳисоб йўқ бўлса, очилади. Бор бўлса, пароли янгиланади. Фақат Ф.И.Ш.ни ўзгартириш учун паролни бўш қолдиринг.</p>
        <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto]" onSubmit={(e) => {
          e.preventDefault();
          const em = pEmail, pw = pPass, nm = pName;
          start(async () => {
            const r = await setUserPassword(em, pw, pRole, nm);
            setMsg(r.ok ? { ok: true, text: pw ? `${em} учун пароль сақланди. Паролни унга айтинг: ${pw}` : `${em}: маълумотлар сақланди` } : { ok: false, text: r.message ?? "Хатолик" });
            if (r.ok) { router.refresh(); if (editing) stopEdit(); }
          });
        }}>
          <input type="email" required readOnly={!!editing} className={clsx("field-input", editing && "bg-canvas text-muted")} placeholder="e-mail манзил" value={pEmail} onChange={(e) => setPEmail(e.target.value)} />
          <input className="field-input" maxLength={120} autoComplete="off" placeholder="Ф.И.Ш. (Фамилия Исм Шарифи)" value={pName} onChange={(e) => setPName(e.target.value)} />
          <div className="relative">
            <input type={showPass ? "text" : "password"} minLength={8} className="field-input pr-16" placeholder={editing ? "янги пароль (ўзгармаса бўш)" : "пароль (камида 8 белги)"} autoComplete="new-password" value={pPass} onChange={(e) => setPPass(e.target.value)} />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink" aria-label={showPass ? "Яшириш" : "Кўрсатиш"}>{showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
            <button type="button" onClick={genPassword} className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-brand-800 hover:bg-brand-50 dark:text-brand-100" title="Тасодифий пароль яратиш" aria-label="Тасодифий пароль яратиш"><Wand2 className="size-4" /></button>
          </div>
          <select className="field-input !w-auto" value={pRole} onChange={(e) => setPRole(e.target.value as AssignableRole)} aria-label="Рол" title={ROLE_HINT[pRole]}>
            <option value="admin">Админ</option>
            <option value="admin1">Админ-1</option>
            <option value="viewer">Фойдаланувчи</option>
          </select>
          <button className="btn btn-primary" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}Сақлаш</button>
        </form>
        {msg && <p role="status" className={clsx("mt-2 text-sm", msg.ok ? "text-ok" : "text-danger")}>{msg.text}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-brand-50 text-left text-xs text-brand-900 dark:bg-brand-950 dark:text-brand-100">
            <tr><th className="px-4 py-2">Ф.И.Ш.</th><th className="px-4 py-2">E-mail</th><th className="px-4 py-2">Рол</th><th className="px-4 py-2">Ҳолат</th><th className="px-4 py-2 text-right">Амаллар</th></tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.email} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{r.full_name || <span className="font-normal text-muted">—</span>}</td>
                <td className="px-4 py-2">{r.email}</td>
                <td className="px-4 py-2">
                  <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", r.role === "super_admin" ? "bg-gold-100 text-brand-950" : r.role === "admin1" ? "bg-gold-100/60 text-brand-950 ring-1 ring-gold-400" : r.role === "admin" ? "bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100" : "bg-canvas text-muted")}>{ROLE_LABEL[r.role]}</span>
                </td>
                <td className="px-4 py-2 text-xs text-muted">{r.pending ? "Ҳали кирмаган" : r.is_blocked ? "Блокланган" : "Фаол"}</td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex gap-2">
                    <button className="btn btn-ghost !min-h-8 !px-2 !py-1" disabled={pending} title="Таҳрирлаш (Ф.И.Ш., рол, пароль)" aria-label={`${r.email}: таҳрирлаш`} onClick={() => startEdit(r)}>
                      <Pencil className="size-4 text-brand-800 dark:text-brand-100" />
                    </button>
                  {r.role !== "super_admin" && (
                    <div className="inline-flex gap-2">
                      {r.role === "admin" || r.role === "admin1"
                        ? <button className="btn btn-ghost !min-h-8 !py-1 text-xs" disabled={pending} onClick={() => act(() => setUserRole(r.email, "viewer"), `${r.email} фойдаланувчи қилинди`)}>Админликдан олиш</button>
                        : <button className="btn btn-ghost !min-h-8 !py-1 text-xs" disabled={pending} onClick={() => act(() => setUserRole(r.email, "admin"), `${r.email} админ қилинди`)}>Админ қилиш</button>}
                      {r.id && r.id !== selfId && (
                        <button className="btn btn-ghost !min-h-8 !px-2 !py-1" disabled={pending} title={r.is_blocked ? "Блокдан чиқариш" : "Блоклаш"} aria-label={r.is_blocked ? "Блокдан чиқариш" : "Блоклаш"}
                          onClick={() => act(() => setUserBlocked(r.id!, !r.is_blocked), r.is_blocked ? "Блокдан чиқарилди" : "Блокланди")}>
                          {r.is_blocked ? <Unlock className="size-4" /> : <Lock className="size-4 text-danger" />}
                        </button>
                      )}
                      {r.id !== selfId && (
                        <button className="btn btn-ghost !min-h-8 !px-2 !py-1" disabled={pending} title="Ўчириш" aria-label={`${r.email}: ўчириш`} onClick={() => remove(r)}>
                          <Trash2 className="size-4 text-danger" />
                        </button>
                      )}
                    </div>
                  )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
