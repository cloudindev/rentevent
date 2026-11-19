"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Link-based tabs for module sub-sections. */
export function SectionTabs({ tabs }: { tabs: { href: string; label: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b px-4 md:px-6" aria-label="Secciones">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn("-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground", active && "border-foreground font-medium text-foreground")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
