import { cn } from "@/lib/utils";

export function Progress({ value, className, tone = "default" }: { value: number; className?: string; tone?: "default" | "danger" | "success" }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width]", tone === "danger" ? "bg-danger" : tone === "success" ? "bg-success" : "bg-foreground/70")} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
