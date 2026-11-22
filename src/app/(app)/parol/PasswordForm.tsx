"use client";
import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";

export function PasswordForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) return setMsg({ ok: false, text: "Пароль камида 8 белгидан иборат бўлсин." });
    if (pw !== pw2) return setMsg({ ok: false, text: "Иккала пароль бир хил эмас." });
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      const same = /different from the old/i.test(error.message);
      return setMsg({ ok: false, text: same ? "Янги пароль эскисидан фарқ қилсин." : "Паролни сақлаб бўлмади. Қайта уриниб кўринг." });
    }
    setPw(""); setPw2("");
    setMsg({ ok: true, text: "Пароль ўзгартирилди." });
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Янги пароль</span>
        <div className="relative">
          <input type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" className="field-input pr-10" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-ink" aria-label={show ? "Яшириш" : "Кўрсатиш"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Паролни такрорланг</span>
        <input type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" className="field-input" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </label>
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}Сақлаш</button>
      {msg && <p role="status" className={clsx("text-sm", msg.ok ? "text-ok" : "text-danger")}>{msg.text}</p>}
    </form>
  );
}
