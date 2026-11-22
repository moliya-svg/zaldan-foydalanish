import Link from "next/link";
import { CalendarPlus, CalendarRange, Home, Building2, ShieldCheck, LogOut } from "lucide-react";
import { A11yBar } from "./A11yBar";
import { Brand } from "./Brand";
import { NavLink } from "./NavLink";
import type { Viewer } from "@/lib/types";

const ROLE_LABEL = { super_admin: "Бош админ", admin: "Админ", viewer: "Фойдаланувчи" } as const;

export function AppShell({ viewer, children }: { viewer: Viewer; children: React.ReactNode }) {
  const items = [
    { href: "/", label: "Бош саҳифа", short: "Бош", icon: <Home className="size-5" />, show: true },
    { href: "/kiritish", label: "KIRITISH BRON", short: "Киритиш", icon: <CalendarPlus className="size-5" />, show: viewer.isAdmin },
    { href: "/korish", label: "KO'RISH BRON", short: "Кўриш", icon: <CalendarRange className="size-5" />, show: true },
    { href: "/xonalar", label: "Зал ва хоналар", short: "Хоналар", icon: <Building2 className="size-5" />, show: true },
    { href: "/boshqaruv", label: "Бошқарув", short: "Бошқарув", icon: <ShieldCheck className="size-5" />, show: viewer.isSuperAdmin },
  ].filter((i) => i.show);

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <header className="no-print bg-brand-900 text-white">
        <div className="border-b border-white/10 bg-brand-950">
          <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-1">
            <span className="text-[11px] text-white/70">Ўзбекистон Республикаси</span>
            <A11yBar />
          </div>
        </div>
        <div className="mx-auto flex max-w-[1800px] items-center gap-6 px-4 py-3">
          <Link href="/" aria-label="Бош саҳифа"><Brand light /></Link>
          <nav className="ml-2 hidden flex-1 items-center gap-1 lg:flex" aria-label="Асосий меню">
            {items.map((i) => (
              <NavLink key={i.href} href={i.href} className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white" activeClassName="bg-white/15 text-white shadow-[inset_0_-3px_0_var(--color-gold-500)]">
                {i.icon}{i.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right text-xs leading-tight sm:block">
              <div className="font-semibold">{viewer.email}</div>
              <div className="text-gold-400">{ROLE_LABEL[viewer.role]}</div>
            </div>
            <form action="/auth/signout" method="post">
              <button className="rounded-lg p-2 hover:bg-white/10" aria-label="Чиқиш" title="Чиқиш"><LogOut className="size-5" /></button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] px-3 py-5 sm:px-4 lg:py-6">{children}</main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface lg:hidden" aria-label="Пастки меню">
        {items.map((i) => (
          <NavLink key={i.href} href={i.href} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted" activeClassName="text-brand-900 dark:text-gold-400">
            {i.icon}{i.short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
