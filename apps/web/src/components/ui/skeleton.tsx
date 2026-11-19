import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton h-4", className)} />;
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border" role="status" aria-label="Cargando">
      <div className="flex gap-4 border-b bg-subtle px-4 py-3">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 border-b px-4 py-3.5 last:border-0">
          {Array.from({ length: cols }, (_, i) => (
            <Skeleton key={i} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-5 p-6" role="status" aria-label="Cargando">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <TableSkeleton />
    </div>
  );
}
