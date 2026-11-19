import * as React from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const tones: Record<Tone, { pill: string; dot: string }> = {
  neutral: { pill: "bg-secondary text-foreground/80", dot: "bg-muted-foreground" },
  success: { pill: "bg-success-bg text-success", dot: "bg-success" },
  warning: { pill: "bg-warning-bg text-warning", dot: "bg-warning" },
  danger: { pill: "bg-danger-bg text-danger", dot: "bg-danger" },
  info: { pill: "bg-info-bg text-info", dot: "bg-info" },
  brand: { pill: "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300", dot: "bg-brand-500" },
};

/** Pill with a coloured dot: "● Disponible", "● Faltan 2", "● Opción". */
export function StatusPill({ tone = "neutral", children, className, dot = true }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium", tones[tone].pill, className)}>
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full", tones[tone].dot)} />}
      {children}
    </span>
  );
}

export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("inline-flex h-5 items-center rounded-md border px-1.5 text-[11px] font-medium text-muted-foreground", className)} {...props} />;
}

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return <kbd className={cn("inline-flex h-5 items-center rounded border bg-background px-1.5 font-sans text-[11px] text-muted-foreground", className)} {...props} />;
}
