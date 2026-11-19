"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Tabs selected by the `tab` query parameter (first tab = no parameter). */
export function QueryTabs({ base, tabs }: { base: string; tabs: { key: string; label: string }[] }) {
  const current = useSearchParams().get("tab") ?? "";
  const active = tabs.some((t) => t.key === current) ? current : "";
  return (
    <nav className="flex gap-1 overflow-x-auto border-b px-4 md:px-6" aria-label="Secciones">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.key ? `${base}?tab=${t.key}` : base}
          aria-current={active === t.key ? "page" : undefined}
          className={cn("-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground", active === t.key && "border-foreground font-medium text-foreground")}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
