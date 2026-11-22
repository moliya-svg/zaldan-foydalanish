"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, Loader2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}` },
    });
    setBusy(false);
    if (error) setError(error.status === 429 ? "Жуда кўп уриниш. Бир дақиқадан кейин қайта уриниб кўринг." : "Код юборилмади: " + error.message);
    else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    if (error) {
      setBusy(false);
      setError("Код нотўғри ёки муддати ўтган.");
      return;
    }
    router.replace(target);
    router.refresh();
  }

  if (step === "code") {
    return (
      <form onSubmit={verify} className="mt-6 space-y-4">
        <p className="text-sm">
          <b>{email}</b> манзилига код юборилди. Хатдаги кодни киритинг ёки хатдаги ҳаволани босинг.
        </p>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Код</span>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input className="field-input pl-9 text-lg tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6,8}" maxLength={8} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </div>
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy || code.length < 6}>
          {busy && <Loader2 className="size-4 animate-spin" />} Кириш
        </button>
        <button type="button" className="flex items-center gap-1 text-sm text-muted hover:underline" onClick={() => { setStep("email"); setCode(""); }}>
          <ArrowLeft className="size-4" /> Бошқа e-mail
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">E-mail</span>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input className="field-input pl-9" type="email" autoComplete="email" required autoFocus placeholder="ism@example.uz" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} Код олиш
      </button>
      <p className="text-xs text-muted">Биринчи марта кирганлар фойдаланувчи (кўриш) ҳуқуқини олади. Брон киритиш ҳуқуқини бош админ беради.</p>
    </form>
  );
}
