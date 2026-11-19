import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Boxes } from "lucide-react";
import { addDays, dayKey } from "@rentevent/core";
import { asc, desc, eq, inspections, itemUnits, items, movements, repairs } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ItemTimeline } from "@/components/app/item-timeline";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/permissions";
import { formatDate, formatDateTime, formatEUR, formatNumber } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { buildTimeline } from "@/server/timeline";
import { ItemActions } from "./item-actions";
import { now } from "@/lib/now";

const UNIT_TONE = { disponible: "success", en_obra: "info", reparacion: "warning", limpieza: "warning", baja: "neutral" } as const;
const MOVE_LABEL: Record<string, string> = { salida: "Salida", retorno: "Retorno", dano: "Daño", perdida: "Pérdida", ajuste: "Ajuste", reparacion_alta: "A reparación", reparacion_baja: "Reparado" };

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await tenantDb(async (tx, ctx) => {
    const [item] = await tx.select().from(items).where(eq(items.id, id));
    if (!item) return null;
    const today = dayKey(now());
    const [units, moves, reps, insps, timeline] = await Promise.all([
      tx.select().from(itemUnits).where(eq(itemUnits.itemId, id)).orderBy(asc(itemUnits.serial)),
      tx.select().from(movements).where(eq(movements.itemId, id)).orderBy(desc(movements.createdAt)).limit(30),
      tx.select().from(repairs).where(eq(repairs.itemId, id)).orderBy(desc(repairs.createdAt)).limit(20),
      tx.select().from(inspections).where(eq(inspections.itemId, id)).orderBy(desc(inspections.inspectedAt)).limit(20),
      buildTimeline(tx, id, today, addDays(today, 27), { withDates: true }),
    ]);
    return { item, units, moves, reps, insps, timeline, role: ctx.role };
  });
  if (!data) notFound();
  const { item } = data;
  const qrs = await Promise.all(data.units.slice(0, 60).map((u) => QRCode.toDataURL(u.qrCode, { margin: 1, width: 120 })));
  const minFree = Math.min(...data.timeline.cells.map((c) => c.available));
  return (
    <>
      <PageHeader icon={Boxes} title={item.name} subtitle={item.sku} back={{ href: "/app/inventario", label: "Inventario" }}>
        {item.pendingValidation && <StatusPill tone="warning">Datos de ejemplo</StatusPill>}
        <ItemActions
          canEdit={can(data.role, "inventario")}
          canCount={can(data.role, "almacen")}
          item={{
            id: item.id,
            sku: item.sku,
            name: item.name,
            category: item.category,
            kind: item.kind as "granel",
            unit: item.unit as "ud",
            role: item.role as "otro",
            roleAmount: item.roleAmount,
            weightKg: item.weightKg,
            volumeM3: item.volumeM3,
            price: Number(item.price),
            priceMode: item.priceMode as "unidad",
            costPrice: Number(item.costPrice),
            replacementCost: Number(item.replacementCost),
            stockTotal: Number(item.stockTotal),
            location: item.location,
            description: item.description,
            inspectionIntervalDays: item.inspectionIntervalDays,
            active: item.active,
          }}
        />
      </PageHeader>
      <PageBody>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Stock total", formatNumber(Number(item.stockTotal)), item.unit === "m2" ? "m²" : "uds"],
            ["En reparación", formatNumber(Number(item.stockRepair)), "uds"],
            ["Mínimo libre 4 semanas", formatNumber(minFree), "uds"],
            ["Tarifa", item.priceMode === "incluido" ? "Incluido" : formatEUR(Number(item.price)), item.priceMode],
            ["Ubicación", item.location ?? "—", item.category],
          ].map(([k, v, s]) => (
            <Card key={k} className="p-4">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="tabular mt-1 text-xl font-semibold">{v}</p>
              <p className="text-xs text-muted-foreground">{s}</p>
            </Card>
          ))}
        </div>
        <ItemTimeline data={data.timeline} title="Disponibilidad" subtitle="Próximas 4 semanas" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Movimientos</CardTitle>
            </CardHeader>
            <CardContent>
              {data.moves.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {data.moves.map((m) => (
                    <li key={m.id} className="flex items-center justify-between py-2">
                      <span>
                        {MOVE_LABEL[m.kind] ?? m.kind} {m.note && <span className="text-muted-foreground">· {m.note}</span>}
                      </span>
                      <span className="tabular text-muted-foreground">
                        {Number(m.quantity) > 0 ? "+" : ""}
                        {formatNumber(Number(m.quantity))} · {formatDateTime(m.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Reparaciones y revisiones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {data.reps.length + data.insps.length === 0 && <p className="text-muted-foreground">Sin historial.</p>}
              {data.reps.map((r) => (
                <p key={r.id} className="flex justify-between">
                  <span>
                    {r.kind === "limpieza" ? "Limpieza" : "Reparación"} · {r.reason}
                  </span>
                  <StatusPill tone={r.status === "reparado" ? "success" : "warning"}>{r.status.replace("_", " ")}</StatusPill>
                </p>
              ))}
              {data.insps.map((i) => (
                <p key={i.id} className="flex justify-between">
                  <span>
                    Revisión {formatDate(i.inspectedAt)} {i.nextDueAt && <span className="text-muted-foreground">· próxima {formatDate(i.nextDueAt)}</span>}
                  </span>
                  <StatusPill tone={i.result === "ok" ? "success" : i.result === "defectos" ? "warning" : "danger"}>{i.result}</StatusPill>
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
        {(item.kind === "seriado" || data.units.length > 0) && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Unidades seriadas ({data.units.length})</h2>
            <Table>
              <THead>
                <TR>
                  <TH>QR</TH>
                  <TH>Número de serie</TH>
                  <TH>Código</TH>
                  <TH>Estado</TH>
                  <TH>Última revisión</TH>
                </TR>
              </THead>
              <TBody>
                {data.units.map((u, i) => (
                  <TR key={u.id}>
                    <TD>{qrs[i] ? <img src={qrs[i]} alt={`QR ${u.qrCode}`} className="size-12 rounded border bg-white p-0.5" /> : null}</TD>
                    <TD className="font-medium">{u.serial}</TD>
                    <TD className="font-mono text-xs">{u.qrCode}</TD>
                    <TD>
                      <StatusPill tone={UNIT_TONE[u.status as keyof typeof UNIT_TONE] ?? "neutral"}>{u.status.replace("_", " ")}</StatusPill>
                    </TD>
                    <TD>{formatDate(u.lastInspectionAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </section>
        )}
      </PageBody>
    </>
  );
}
