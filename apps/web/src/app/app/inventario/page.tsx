import { Boxes } from "lucide-react";
import { asc, items, warehouses } from "@rentevent/db";
import { availableMap } from "@rentevent/db/services";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { loadViews } from "@/server/views";
import { InventoryTabs } from "./tabs";
import { InventoryTable } from "./inventory-table";

export const metadata = { title: "Inventario" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  const sp = await searchParams;
  const data = await tenantDb(async (tx, ctx) => {
    const rows = await tx.select().from(items).orderBy(asc(items.category), asc(items.name));
    const now = new Date();
    const avail = await availableMap(tx, rows.map((r) => r.id), { start: now, end: new Date(now.getTime() + 86_400_000) });
    const whs = await tx.select().from(warehouses);
    const views = await loadViews(tx, ctx.user.id, "items");
    return { rows, avail, whs, views, role: ctx.role };
  });
  const list = data.rows.map((r) => ({
    id: r.id,
    sku: r.sku,
    name: r.name,
    category: r.category,
    kind: r.kind,
    unit: r.unit,
    role: r.role,
    stockTotal: Number(r.stockTotal),
    stockRepair: Number(r.stockRepair),
    availableToday: data.avail.get(r.id) ?? 0,
    location: r.location ?? "",
    price: Number(r.price),
    priceMode: r.priceMode,
    weightKg: r.weightKg,
    active: r.active,
    pending: r.pendingValidation,
  }));
  return (
    <>
      <PageHeader icon={Boxes} title="Inventario" subtitle={`${list.length} artículos`} />
      <InventoryTabs />
      <PageBody>
        <InventoryTable rows={list} views={data.views} canEdit={can(data.role, "inventario")} openNew={sp.nuevo === "1"} />
      </PageBody>
    </>
  );
}
