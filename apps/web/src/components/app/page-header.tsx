import type { LucideIcon } from "lucide-react";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({ icon: Icon, title, subtitle, children, back, className }: { icon: LucideIcon; title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode; back?: { href: string; label: string }; className?: string }) {
  return (
    <header className={cn("sticky top-0 z-20 flex min-h-14 flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-2.5 backdrop-blur md:px-6", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Icon className="size-[18px] shrink-0 text-foreground/70" strokeWidth={1.6} />
        {back && (
          <>
            <Link href={back.href} className="truncate text-[15px] text-muted-foreground hover:text-foreground">
              {back.label}
            </Link>
            <span className="text-muted-foreground">/</span>
          </>
        )}
        <h1 className="truncate text-[15px] font-semibold">{title}</h1>
        {subtitle && <span className="hidden truncate text-sm text-muted-foreground sm:inline">{subtitle}</span>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function DateChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-sm">
      <CalendarDays className="size-4 text-muted-foreground" strokeWidth={1.6} />
      {children}
    </span>
  );
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6", className)}>{children}</div>;
}
