import { Warehouse } from "lucide-react";
import { asc, eq, items, sql } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { AlmacenTabs } from "../tabs";
import { CountList } from "./count-list";
import { nowMs } from "@/server/warehouse/logic";

export const metadata = { title: "Recuentos" };
const STALE_DAYS = 90;

export default async function CountsPage() {
  const d = await tenantDb(async (tx, ctx) => ({
    rows: await tx
      .select({
        id: items.id,
        sku: items.sku,
        name: items.name,
        category: items.category,
        location: items.location,
        unit: items.unit,
        stockTotal: items.stockTotal,
        lastCount: sql<string | null>`(select max(c.created_at) from stock_counts c where c.item_id = ${items.id})`,
        lastDiff: sql<number | null>`(select (c.counted - c.expected)::float from stock_counts c where c.item_id = ${items.id} order by c.created_at desc limit 1)`,
      })
      .from(items)
      .where(eq(items.active, true))
      .orderBy(asc(items.location), asc(items.name)),
    canCount: can(ctx.role, "almacen"),
  }));
  const now = nowMs();
  const rows = d.rows
    .map((r) => ({
      ...r,
      stockTotal: Number(r.stockTotal),
      lastCount: r.lastCount ? new Date(r.lastCount).toISOString() : null,
      ageDays: r.lastCount ? Math.floor((now - new Date(r.lastCount).getTime()) / 86_400_000) : null,
    }))
    .sort((a, b) => (b.ageDays ?? 1e6) - (a.ageDays ?? 1e6));
  const due = rows.filter((r) => r.ageDays == null || r.ageDays >= STALE_DAYS).length;
  return (
    <>
      <PageHeader icon={Warehouse} title="Almacén" subtitle="Recuentos" />
      <AlmacenTabs />
      <PageBody>
        <p className="text-sm text-muted-foreground">
          Inventario cíclico: primero los artículos que llevan más tiempo sin contarse. <strong className="text-foreground">{due}</strong> artículos sin contar en los últimos {STALE_DAYS} días.
        </p>
        <CountList rows={rows} canCount={d.canCount} staleDays={STALE_DAYS} />
      </PageBody>
    </>
  );
}
