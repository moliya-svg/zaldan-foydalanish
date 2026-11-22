import Image from "next/image";

export function Brand({ size = 44, light = false }: { size?: number; light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Image src="/brand/logo.svg" alt="Ўқув маркази эмблемаси" width={size} height={size} priority />
      <div className="leading-tight">
        <div className={`text-[11px] uppercase tracking-wider lg:max-xl:hidden ${light ? "text-white/75" : "text-muted"}`}>
          Иқтисодиёт ва молия вазирлиги ҳузуридаги
        </div>
        <div className={`font-bold ${light ? "text-white" : "text-brand-900 dark:text-white"}`}>Ўқув маркази</div>
      </div>
    </div>
  );
}
