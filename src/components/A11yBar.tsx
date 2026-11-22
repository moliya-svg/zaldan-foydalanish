"use client";
import { useEffect, useState } from "react";
import { Contrast, Moon, Sun, RotateCcw } from "lucide-react";

type Prefs = { size?: number; gray?: boolean; dark?: boolean };

function load(): Prefs {
  try { return JSON.parse(localStorage.getItem("a11y") || "{}"); } catch { return {}; }
}
function save(p: Prefs) {
  try { localStorage.setItem("a11y", JSON.stringify(p)); } catch { /* шахсий режим */ }
}

export function A11yBar() {
  const [prefs, setPrefs] = useState<Prefs>({});
  useEffect(() => setPrefs(load()), []);

  function apply(next: Prefs) {
    const d = document.documentElement;
    d.style.setProperty("--base-size", (next.size ?? 16) + "px");
    d.classList.toggle("grayscale-mode", !!next.gray);
    const dark = next.dark ?? matchMedia("(prefers-color-scheme: dark)").matches;
    d.classList.toggle("dark", dark);
    setPrefs(next);
    save(next);
  }
  const size = prefs.size ?? 16;
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="hidden sm:inline opacity-80 mr-1">Шрифт</span>
      <button className="rounded px-2 py-1 hover:bg-white/10" aria-label="Шрифтни кичрайтириш" onClick={() => apply({ ...prefs, size: Math.max(14, size - 1) })}>A−</button>
      <button className="rounded px-2 py-1 hover:bg-white/10" aria-label="Шрифтни катталаштириш" onClick={() => apply({ ...prefs, size: Math.min(20, size + 1) })}>A+</button>
      <button className="rounded px-2 py-1 hover:bg-white/10 inline-flex items-center gap-1" aria-pressed={!!prefs.gray} onClick={() => apply({ ...prefs, gray: !prefs.gray })}>
        <Contrast className="size-3.5" /> <span className="hidden sm:inline">Рангсиз режим</span>
      </button>
      <button className="rounded px-2 py-1 hover:bg-white/10" aria-label="Тунги режим" onClick={() => apply({ ...prefs, dark: !isDark })}>
        {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      </button>
      <button className="rounded px-2 py-1 hover:bg-white/10" aria-label="Созламаларни тиклаш" onClick={() => apply({})}>
        <RotateCcw className="size-3.5" />
      </button>
    </div>
  );
}
