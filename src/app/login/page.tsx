import type { Metadata } from "next";
import { Brand } from "@/components/Brand";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Кириш" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const notice = sp.blocked
    ? "Ҳисобингиз блокланган ёки ҳали фаол эмас. Бош админга мурожаат қилинг."
    : sp.error
      ? "Ҳавола эскирган ёки нотўғри. Кодни қайта сўранг."
      : null;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Brand light size={56} />
        <div className="relative z-10 max-w-xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">26 зал ва хона</p>
          <h1 className="text-4xl font-bold leading-tight">Зал ва хоналарни<br />олдиндан бронлаш тизими</h1>
          <p className="mt-5 max-w-md text-white/75">
            Катта ва кичик мажлислар заллари ҳамда ўқув хоналарининг кимга, қайси кундан қайси кунгача ва соат нечадан нечагача банд эканини бир қарашда кўринг.
          </p>
        </div>
        <p className="text-xs text-white/50">Тошкент ш., Дархонтепа 7 · +998 (71) 239-19-18</p>
        {/* Безак: календарь тўри */}
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 grid size-[520px] rotate-[-8deg] grid-cols-7 gap-2 opacity-[0.13]">
          {Array.from({ length: 42 }, (_, i) => (
            <div key={i} className={`rounded-lg border border-white ${[9, 10, 11, 17, 24, 25, 31].includes(i) ? "bg-gold-500" : ""}`} />
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center bg-surface px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Brand size={48} /></div>
          <h2 className="text-2xl font-bold">Тизимга кириш</h2>
          <p className="mt-1 text-sm text-muted">E-mail ва пароль билан киринг. Пароль бўлмаса, почтага бир марталик код юборамиз.</p>
          {notice && <p role="alert" className="mt-4 rounded-lg bg-gold-100 px-3 py-2 text-sm text-ink">{notice}</p>}
          <LoginForm next={sp.next} />
        </div>
      </section>
    </div>
  );
}
