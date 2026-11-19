import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center", className)}>
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-secondary">
        <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Algo ha fallado", description, action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-danger-bg px-5 py-4 text-sm">
      <p className="font-medium text-danger">{title}</p>
      {description && <p className="mt-1 text-foreground/80">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
