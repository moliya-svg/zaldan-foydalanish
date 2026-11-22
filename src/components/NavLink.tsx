"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function NavLink({ href, className, activeClassName, children }: { href: string; className: string; activeClassName: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link href={href} className={clsx(className, active && activeClassName)} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
