"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { HELP_ICONS } from "./icons";

export type HelpNavGroup = { title: string; areas: { slug: string; title: string; articles: { slug: string; title: string }[] }[] };

/** Left index of the help centre: groups, areas, and the current area's guides. */
export function HelpNav({ groups }: { groups: HelpNavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [, , areaSlug, articleSlug] = pathname.split("/");
  const current = groups.flatMap((g) => g.areas).find((a) => a.slug === areaSlug);
  return (
    <nav aria-label="Índice de la ayuda" className="text-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between rounded-xl border px-4 py-3 font-medium lg:hidden" aria-expanded={open}>
        <span className="flex items-center gap-2">
          <List className="size-4" aria-hidden /> {current ? current.title : "Índice"}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <div className={cn("mt-3 space-y-5 lg:mt-0 lg:block", !open && "hidden")}>
        <Link href="/ayuda" className="block font-medium text-muted-foreground hover:text-foreground">
          ← Centro de ayuda
        </Link>
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
            <ul className="space-y-0.5">
              {g.areas.map((a) => {
                const Icon = HELP_ICONS[a.slug];
                const isArea = a.slug === areaSlug;
                return (
                  <li key={a.slug}>
                    <Link
                      href={`/ayuda/${a.slug}`}
                      onClick={() => setOpen(false)}
                      className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5", isArea && !articleSlug ? "bg-subtle font-semibold" : isArea ? "font-semibold" : "text-foreground/80 hover:bg-subtle")}
                      aria-current={isArea && !articleSlug ? "page" : undefined}
                    >
                      {Icon && <Icon className={cn("size-4 shrink-0", isArea ? "text-brand-600" : "text-muted-foreground")} aria-hidden />}
                      {a.title}
                    </Link>
                    {isArea && (
                      <ul className="mb-1 ml-[19px] mt-1 space-y-0.5 border-l pl-3">
                        {a.articles.map((x) => (
                          <li key={x.slug}>
                            <Link
                              href={`/ayuda/${a.slug}/${x.slug}`}
                              onClick={() => setOpen(false)}
                              className={cn("block rounded-md px-2 py-1 text-[13px] leading-snug", x.slug === articleSlug ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-950" : "text-muted-foreground hover:text-foreground")}
                              aria-current={x.slug === articleSlug ? "page" : undefined}
                            >
                              {x.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
