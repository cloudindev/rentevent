import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-3 p-6" role="status" aria-label="Cargando tablero">
      <Skeleton className="h-8 w-80" />
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 flex-1" />
        </div>
      ))}
    </div>
  );
}
