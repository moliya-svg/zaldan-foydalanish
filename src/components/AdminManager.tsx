"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldPlus, Lock, Unlock } from "lucide-react";
import clsx from "clsx";
import { setUserRole, setUserBlocked } from "@/lib/actions";
import type { Role } from "@/lib/types";

export interface UserRow { id: string | null; email: string; role: Role; is_blocked: boolean; created_at: string | null; pending: boolean }

const LABEL: Record<Role, string> = { super_admin: "Бош админ", admin: "Админ", viewer: "Фойдаланувчи" };

export function AdminManager({ rows, selfId }: { rows: UserRow[]; selfId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<{ ok: boolean; message?: string }>, okText: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.message ?? "Хатолик" });
      if (r.ok) router.refresh();
    });

  const sorted = [...rows].sort((a, b) => ["super_admin", "admin", "viewer"].indexOf(a.role) - ["super_admin", "admin", "viewer"].indexOf(b.role));

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line p-4">
        <h2 className="mb-2 font-semibold">Админ қўшиш</h2>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); act(() => setUserRole(email, "admin"), `${email} админ қилинди`); setEmail(""); }}>
          <input type="email" required className="field-input max-w-sm flex-1" placeholder="e-mail манзил" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-primary" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldPlus className="size-4" />}Админ қилиш</button>
        </form>
        <p className="mt-2 text-xs text-muted">Ҳали тизимга кирмаган e-mail ҳам қўшиш мумкин. У биринчи кирганда дарҳол админ бўлади.</p>
        {msg && <p role="status" className={clsx("mt-2 text-sm", msg.ok ? "text-ok" : "text-danger")}>{msg.text}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-brand-50 text-left text-xs text-brand-900 dark:bg-brand-950 dark:text-brand-100">
            <tr><th className="px-4 py-2">E-mail</th><th className="px-4 py-2">Рол</th><th className="px-4 py-2">Ҳолат</th><th className="px-4 py-2 text-right">Амаллар</th></tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.email} className="border-t border-line">
                <td className="px-4 py-2 font-medium">{r.email}</td>
                <td className="px-4 py-2">
                  <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", r.role === "super_admin" ? "bg-gold-100 text-brand-950" : r.role === "admin" ? "bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100" : "bg-canvas text-muted")}>{LABEL[r.role]}</span>
                </td>
                <td className="px-4 py-2 text-xs text-muted">{r.pending ? "Ҳали кирмаган" : r.is_blocked ? "Блокланган" : "Фаол"}</td>
                <td className="px-4 py-2 text-right">
                  {r.role !== "super_admin" && (
                    <div className="inline-flex gap-2">
                      {r.role === "admin"
                        ? <button className="btn btn-ghost !min-h-8 !py-1 text-xs" disabled={pending} onClick={() => act(() => setUserRole(r.email, "viewer"), `${r.email} фойдаланувчи қилинди`)}>Админликдан олиш</button>
                        : <button className="btn btn-ghost !min-h-8 !py-1 text-xs" disabled={pending} onClick={() => act(() => setUserRole(r.email, "admin"), `${r.email} админ қилинди`)}>Админ қилиш</button>}
                      {r.id && r.id !== selfId && (
                        <button className="btn btn-ghost !min-h-8 !px-2 !py-1" disabled={pending} title={r.is_blocked ? "Блокдан чиқариш" : "Блоклаш"} aria-label={r.is_blocked ? "Блокдан чиқариш" : "Блоклаш"}
                          onClick={() => act(() => setUserBlocked(r.id!, !r.is_blocked), r.is_blocked ? "Блокдан чиқарилди" : "Блокланди")}>
                          {r.is_blocked ? <Unlock className="size-4" /> : <Lock className="size-4 text-danger" />}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
