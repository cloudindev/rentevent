import Link from "next/link";
import { History, Wrench } from "lucide-react";
import { asc, eq, items } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { formatDateTime, formatEUR, formatNumber } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { itemHistory } from "@/server/warehouse/maintenance";
import { MaintenanceTabs } from "../tabs";
import { ItemPicker } from "./item-picker";

export const metadata = { title: "Historial de mantenimiento" };

const MOVE: Record<string, string> = { salida: "Salida a obra", retorno: "Retorno", dano: "Daño", perdida: "Pérdida / baja", ajuste: "Ajuste de stock", reparacion_alta: "Entra en reparación", reparacion_baja: "Sale de reparación" };

type Event = { at: Date; kind: "movimiento" | "reparacion" | "revision"; title: string; detail: string; tone: "neutral" | "success" | "warning" | "danger" | "info" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ articulo?: string }> }) {
  const { articulo } = await searchParams;
  const valid = articulo && /^[0-9a-f-]{36}$/.test(articulo) ? articulo : null;
  const d = await tenantDb(async (tx) => {
    const list = await tx.select({ id: items.id, name: items.name, category: items.category }).from(items).orderBy(asc(items.category), asc(items.name));
    if (!valid) return { list, item: null, h: null };
    const [item] = await tx.select().from(items).where(eq(items.id, valid));
    return { list, item: item ?? null, h: item ? await itemHistory(tx, valid) : null };
  });
  const events: Event[] = d.h
    ? [
        ...d.h.movements.map((m) => ({ at: m.createdAt, kind: "movimiento" as const, title: MOVE[m.kind] ?? m.kind, detail: `${Number(m.quantity) > 0 ? "+" : ""}${formatNumber(Number(m.quantity))}${m.note ? ` · ${m.note}` : ""}`, tone: (m.kind === "dano" || m.kind === "perdida" ? "danger" : m.kind.startsWith("reparacion") ? "warning" : "neutral") as Event["tone"] })),
        ...d.h.repairs.map((r) => ({ at: r.createdAt, kind: "reparacion" as const, title: `${r.kind === "limpieza" ? "Limpieza" : "Reparación"} · ${r.status.replace("_", " ")}`, detail: `${formatNumber(Number(r.quantity))} uds · ${r.reason}${Number(r.cost) ? ` · ${formatEUR(Number(r.cost))}` : ""}`, tone: (r.status === "reparado" ? "success" : r.status === "baja" ? "danger" : "warning") as Event["tone"] })),
        ...d.h.inspections.map((i) => ({ at: i.inspectedAt, kind: "revision" as const, title: `Revisión · ${i.result === "ok" ? "apta" : i.result === "defectos" ? "con defectos" : "no apta"}`, detail: [i.inspector, i.notes].filter(Boolean).join(" · "), tone: (i.result === "ok" ? "success" : i.result === "defectos" ? "warning" : "danger") as Event["tone"] })),
      ].sort((a, b) => b.at.getTime() - a.at.getTime())
    : [];
  return (
    <>
      <PageHeader icon={Wrench} title="Mantenimiento" subtitle="Historial por artículo" />
      <MaintenanceTabs />
      <PageBody className="max-w-4xl">
        <ItemPicker items={d.list} value={valid} />
        {!d.item ? (
          <EmptyState icon={History} title="Elige un artículo" description="Verás sus salidas, retornos, daños, reparaciones, limpiezas y revisiones en orden cronológico." />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{d.item.name}</h2>
              <Link href={`/app/inventario/${d.item.id}`} className="text-sm text-link hover:underline">Ver ficha de inventario</Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Stock {formatNumber(Number(d.item.stockTotal))} · en reparación {formatNumber(Number(d.item.stockRepair))}
              {d.item.inspectionIntervalDays ? ` · revisión cada ${d.item.inspectionIntervalDays} días` : ""}
            </p>
            {events.length === 0 ? (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Sin historial todavía.</p>
            ) : (
              <ol className="relative space-y-3 border-l pl-5">
                {events.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-background bg-border-strong" />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={e.tone}>{e.title}</StatusPill>
                      <span className="text-xs text-muted-foreground">{formatDateTime(e.at)}</span>
                    </div>
                    {e.detail && <p className="mt-1 text-sm">{e.detail}</p>}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
