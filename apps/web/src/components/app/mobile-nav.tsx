"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Search } from "lucide-react";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/dialog";
import { NAV, SETTINGS_ITEM } from "./nav";
import { useCommandPalette } from "./command-palette";

export function MobileNav({ role, tenantName }: { role: string; tenantName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const palette = useCommandPalette();
  return (
    <div className="flex h-12 items-center gap-2 border-b px-3 md:hidden">
      <button onClick={() => setOpen(true)} className="rounded-md p-2 hover:bg-accent" aria-label="Abrir menú">
        <Menu className="size-5" />
      </button>
      <span className="flex-1 truncate text-sm font-semibold">{tenantName}</span>
      <button onClick={() => palette.setOpen(true)} className="rounded-md p-2 hover:bg-accent" aria-label="Buscar">
        <Search className="size-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={tenantName} side="left" className="max-w-[300px]">
        <nav className="-m-2 grid gap-3">
          {NAV.map((g, gi) => (
            <div key={gi}>
              {g.label && <p className="px-2 pb-1 text-xs text-muted-foreground">{g.label}</p>}
              {g.items
                .filter((i) => can(role, i.permission))
                .map((i) => (
                  <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className={cn("flex h-9 items-center gap-2.5 rounded-lg px-2 text-sm", pathname.startsWith(i.href) && "bg-accent font-medium")}>
                    <i.icon className="size-4" strokeWidth={1.6} /> {i.label}
                  </Link>
                ))}
            </div>
          ))}
          <Link href={SETTINGS_ITEM.href} onClick={() => setOpen(false)} className="flex h-9 items-center gap-2.5 rounded-lg px-2 text-sm">
            <SETTINGS_ITEM.icon className="size-4" strokeWidth={1.6} /> {SETTINGS_ITEM.label}
          </Link>
        </nav>
      </Sheet>
    </div>
  );
}
