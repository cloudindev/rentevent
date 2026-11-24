import Link from "next/link";
import { Boxes, Package, Printer, Search } from "lucide-react";
import { and, asc, eq, ilike, inArray, isNotNull, itemUnits, items, or, orders, unitContents, warehouses, type SQL } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Input, NativeSelect } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { CONTAINER_LABEL, normalizeCode, UNIT_STATUS_LABEL, UNIT_STATUS_TONE, unitWhere } from "@/server/warehouse/logic";
import { InventoryTabs } from "../tabs";

export const metadata = { title: "Unidades" };

const LIMIT = 300;

export default async function UnitsPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; tipo?: string }> }) {
  const sp = await searchParams;
  const q = sp.q ? normalizeCode(sp.q).slice(0, 80) : "";
  const estado = sp.estado && sp.estado in UNIT_STATUS_LABEL ? sp.estado : "";
  const tipo = sp.tipo === "contenedores" ? "contenedores" : "";
  const d = await tenantDb(async (tx) => {
    const where: SQL[] = [];
    if (q) where.push(or(ilike(itemUnits.serial, `%${q}%`), ilike(itemUnits.qrCode, `%${q}%`), ilike(items.name, `%${q}%`), ilike(items.sku, `%${q}%`))!);
    if (estado) where.push(eq(itemUnits.status, estado));
    if (tipo) where.push(isNotNull(items.container));
    const rows = await tx
      .select({ unit: itemUnits, item: { id: items.id, name: items.name, sku: items.sku, container: items.container, location: items.location, warehouseId: items.warehouseId } })
      .from(itemUnits)
      .innerJoin(items, eq(items.id, itemUnits.itemId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(items.name), asc(itemUnits.serial))
      .limit(LIMIT + 1);
    const orderIds = [...new Set(rows.map((r) => r.unit.currentOrderId).filter((x): x is string => Boolean(x)))];
    const parentIds = [...new Set(rows.map((r) => r.unit.parentUnitId).filter((x): x is string => Boolean(x)))];
    const containerIds = rows.filter((r) => r.item.container).map((r) => r.unit.id);
    const [ords, parents, whs, childCounts, bulk, counts] = await Promise.all([
      orderIds.length ? tx.select({ id: orders.id, number: orders.number, title: orders.title }).from(orders).where(inArray(orders.id, orderIds)) : [],
      parentIds.length ? tx.select({ id: itemUnits.id, serial: itemUnits.serial, name: items.name }).from(itemUnits).innerJoin(items, eq(items.id, itemUnits.itemId)).where(inArray(itemUnits.id, parentIds)) : [],
      tx.select({ id: warehouses.id, name: warehouses.name }).from(warehouses),
      containerIds.length ? tx.select({ parent: itemUnits.parentUnitId }).from(itemUnits).where(inArray(itemUnits.parentUnitId, containerIds)) : [],
      containerIds.length ? tx.select({ c: unitContents.containerUnitId, q: unitContents.quantity }).from(unitContents).where(inArray(unitContents.containerUnitId, containerIds)) : [],
      tx.select({ status: itemUnits.status }).from(itemUnits),
    ]);
    return { rows, ords, parents, whs, childCounts, bulk, counts };
  });
  const more = d.rows.length > LIMIT;
  const rows = d.rows.slice(0, LIMIT);
  const byStatus = new Map<string, number>();
  for (const c of d.counts) byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(estado && { estado }), ...(tipo && { tipo }), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    const s = p.toString();
    return `/app/inventario/unidades${s ? `?${s}` : ""}`;
  };
  return (
    <>
      <PageHeader icon={Boxes} title="Inventario" />
      <InventoryTabs />
      <PageBody>
        <div className="flex flex-wrap gap-2">
          <Link href={qs({ estado: "" })} className={cn("rounded-full border px-3 py-1 text-sm", !estado ? "border-foreground bg-foreground text-background" : "hover:bg-subtle")}>
            Todas <span className="tabular opacity-70">{formatNumber(d.counts.length)}</span>
          </Link>
          {Object.entries(UNIT_STATUS_LABEL).map(([k, label]) =>
            byStatus.get(k) ? (
              <Link key={k} href={qs({ estado: k })} className={cn("rounded-full border px-3 py-1 text-sm", estado === k ? "border-foreground bg-foreground text-background" : "hover:bg-subtle")}>
                {label} <span className="tabular opacity-70">{formatNumber(byStatus.get(k)!)}</span>
              </Link>
            ) : null,
          )}
        </div>
        <form className="flex flex-wrap items-center gap-2" action="/app/inventario/unidades">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Número de serie, código QR o artículo" className="pl-8" aria-label="Buscar unidad" />
          </div>
          {estado && <input type="hidden" name="estado" value={estado} />}
          <NativeSelect name="tipo" defaultValue={tipo} aria-label="Tipo" className="w-auto">
            <option value="">Todas las unidades</option>
            <option value="contenedores">Solo cajas y conjuntos</option>
          </NativeSelect>
          <Button type="submit" variant="outline">
            Buscar
          </Button>
          {rows.length > 0 && rows.length <= 500 && (
            <Button asChild variant="outline">
              <a href={`/app/inventario/etiquetas?${rows.map((r) => `unit=${r.unit.id}`).join("&")}`} target="_blank" rel="noreferrer">
                <Printer /> Etiquetas ({rows.length})
              </a>
            </Button>
          )}
        </form>
        {rows.length === 0 ? (
          <EmptyState
            icon={Package}
            title={q || estado || tipo ? "Ninguna unidad coincide" : "Aún no hay unidades con número de serie"}
            description="Da de alta unidades desde la ficha de un artículo con Generar QR: cada una recibe su número de serie y su código QR. Marca un artículo como caja o conjunto para empaquetar otras unidades dentro."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Unidad</TH>
                <TH>Estado</TH>
                <TH>Dónde está</TH>
                <TH>Contenido</TH>
                <TH className="text-right">Última vez vista</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map(({ unit: u, item }) => {
                const kids = item.container ? d.childCounts.filter((c) => c.parent === u.id).length : 0;
                const bulk = item.container ? d.bulk.filter((b) => b.c === u.id).reduce((s, b) => s + Number(b.q), 0) : 0;
                const where = unitWhere({
                  status: u.status,
                  parent: d.parents.find((p) => p.id === u.parentUnitId) ?? null,
                  order: d.ords.find((o) => o.id === u.currentOrderId) ?? null,
                  warehouseName: d.whs.find((w) => w.id === (u.warehouseId ?? item.warehouseId))?.name ?? null,
                  shelf: u.location ?? item.location,
                });
                return (
                  <TR key={u.id}>
                    <TD>
                      <Link href={`/app/inventario/unidades/${u.id}`} className="font-medium hover:underline">
                        {u.serial}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {item.name}
                        {item.container && <span className="ml-1.5 rounded bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-foreground">{CONTAINER_LABEL[item.container]}</span>}
                      </p>
                    </TD>
                    <TD>
                      <StatusPill tone={UNIT_STATUS_TONE[u.status] ?? "neutral"}>{UNIT_STATUS_LABEL[u.status] ?? u.status}</StatusPill>
                    </TD>
                    <TD className="text-sm">{where}</TD>
                    <TD className="text-sm text-muted-foreground">{item.container ? `${kids} ${kids === 1 ? "unidad" : "unidades"}${bulk ? ` + ${formatNumber(bulk)} a granel` : ""}` : "—"}</TD>
                    <TD className="text-right text-sm text-muted-foreground">{formatDateTime(u.lastSeenAt ?? u.updatedAt)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        {more && <p className="text-sm text-muted-foreground">Se muestran las primeras {LIMIT} unidades. Afina la búsqueda para ver el resto.</p>}
      </PageBody>
    </>
  );
}
