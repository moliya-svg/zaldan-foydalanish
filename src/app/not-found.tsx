import Link from "next/link";
export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div><p className="text-5xl font-bold text-brand-900 dark:text-white">404</p><p className="mt-2 text-muted">Саҳифа топилмади.</p><Link href="/korish" className="btn btn-primary mt-5">Банд зал ва хоналар</Link></div>
    </div>
  );
}
