"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/app/personal", label: "Fichas" },
  { href: "/app/personal/tablero", label: "Tablero" },
  { href: "/app/personal/fichajes", label: "Fichajes" },
  { href: "/app/personal/parte", label: "Partes" },
];

export function PersonalTabs() {
  const p = usePathname();
  return (
    <nav className="flex gap-1 border-b px-4 md:px-6" aria-label="Secciones de personal">
      {TABS.map((t) => {
        const active = t.href === "/app/personal" ? p === t.href || /^\/app\/personal\/[0-9a-f-]{36}/.test(p) : p.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("-mb-px border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground", active && "border-foreground font-medium text-foreground")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
