"use client";
import { useEffect, useState } from "react";
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
  const [now, setNow] = useState(() => Date.now());
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const left = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  // Хат юборилгандан кейин 60 сония кутиш (саҳифа янгиланса ҳам сақланади)
  useEffect(() => {
    try { setCooldownUntil(Number(localStorage.getItem("otp-cooldown") || 0)); } catch { /* шахсий режим */ }
  }, []);
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooldownUntil]);
  function startCooldown(sec: number) {
    const until = Date.now() + sec * 1000;
    setCooldownUntil(until);
    setNow(Date.now());
    try { localStorage.setItem("otp-cooldown", String(until)); } catch { /* шахсий режим */ }
  }

  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy || left > 0) {
      if (left > 0) setStep("code");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}` },
    });
    setBusy(false);
    if (!error) {
      startCooldown(60);
      setStep("code");
    } else if (error.status === 429) {
      // Хат яқинда юборилган: янгисини сўрамасдан, борини ишлатишни таклиф қиламиз
      startCooldown(60);
      setStep("code");
      setError("Хат яқинда юборилган. Почтангиздаги энг охирги хатни очинг.");
    } else {
      setError("Хат юборилмади: " + error.message);
    }
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
          <b>{email || "E-mail"}</b> манзилига хат юборилди. Хатдаги ҳаволани <b>шу браузерда</b> босинг ёки хатда код бўлса, уни шу ерга киритинг.
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
        <button type="button" className="w-full text-sm font-medium text-brand-800 hover:underline disabled:text-muted disabled:no-underline dark:text-brand-100" disabled={busy || left > 0} onClick={() => { setError(null); sendCode(); }}>
          {left > 0 ? `Хатни қайта юбориш: ${left} сониядан кейин` : "Хатни қайта юбориш"}
        </button>
        <button type="button" className="flex items-center gap-1 text-sm text-muted hover:underline" onClick={() => { setStep("email"); setCode(""); setError(null); }}>
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
        {busy && <Loader2 className="size-4 animate-spin" />} {left > 0 ? "Кодни киритиш" : "Код олиш"}
      </button>
      {left > 0 && <p className="text-xs text-muted">Хат юборилган. Янгисини {left} сониядан кейин сўраш мумкин.</p>}
      <p className="text-xs text-muted">Биринчи марта кирганлар фойдаланувчи (кўриш) ҳуқуқини олади. Брон киритиш ҳуқуқини бош админ беради.</p>
    </form>
  );
}
