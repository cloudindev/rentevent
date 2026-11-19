"use client";
import { useEffect, useState } from "react";
import { ItemTimeline, type TimelineData } from "@/components/app/item-timeline";
import { Skeleton } from "@/components/ui/skeleton";
import type { Catalogue } from "@/lib/order-model";
import { getItemTimeline } from "@/server/actions/orders";

export function TimelineCard({ orderId, itemId, quantity, catalogue, version, saved }: { orderId: string; itemId: string; quantity: number; catalogue: Catalogue; version: string; saved: boolean }) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const r = await getItemTimeline({ orderId, itemId, quantity });
      if (!alive) return;
      if (r.ok) {
        setData(r.data);
        setError(null);
      } else setError(r.error);
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [orderId, itemId, quantity, version, saved]);
  const item = catalogue.items.find((i) => i.id === itemId);
  if (error) return <p className="rounded-xl border px-4 py-3 text-sm text-danger">{error}</p>;
  if (!data)
    return (
      <div className="space-y-3 rounded-xl border p-5" role="status" aria-label="Cargando línea de tiempo">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-9" />
      </div>
    );
  return <ItemTimeline data={data} title={item?.name ?? "Artículo"} subtitle={`${item ? item.stockTotal - item.stockRepair : 0} en stock`} />;
}
