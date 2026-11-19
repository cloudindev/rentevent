import { Wrench } from "lucide-react";
import { and, asc, desc, eq, gte, inArray, items, itemUnits, orders, repairs, or, isNull } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { MaintenanceTabs } from "./tabs";
import { RepairBoard, type RepairCard } from "./repair-board";
import { nowMs } from "@/server/warehouse/logic";

/** Server view for the repair and cleaning boards. */
export async function RepairsView({ kind }: { kind: "reparacion" | "limpieza" }) {
  const d = await tenantDb(async (tx, ctx) => {
    const since = new Date(nowMs() - 60 * 86_400_000);
    const rows = await tx
      .select({
        id: repairs.id,
        itemId: repairs.itemId,
        itemName: items.name,
        sku: items.sku,
        serial: itemUnits.serial,
        quantity: repairs.quantity,
        status: repairs.status,
        reason: repairs.reason,
        cost: repairs.cost,
        resolution: repairs.resolution,
        createdAt: repairs.createdAt,
        closedAt: repairs.closedAt,
        orderNumber: orders.number,
      })
      .from(repairs)
      .innerJoin(items, eq(items.id, repairs.itemId))
      .leftJoin(itemUnits, eq(itemUnits.id, repairs.unitId))
      .leftJoin(orders, eq(orders.id, repairs.orderId))
      .where(and(eq(repairs.kind, kind), or(inArray(repairs.status, ["pendiente", "en_curso"]), gte(repairs.closedAt, since), isNull(repairs.closedAt))))
      .orderBy(desc(repairs.createdAt));
    const its = await tx.select({ id: items.id, name: items.name, category: items.category, free: items.stockTotal, repair: items.stockRepair }).from(items).where(eq(items.active, true)).orderBy(asc(items.category), asc(items.name));
    return { rows, its, canEdit: can(ctx.role, "mantenimiento") };
  });
  const cards: RepairCard[] = d.rows.map((r) => ({ ...r, quantity: Number(r.quantity), cost: Number(r.cost), createdAt: r.createdAt.toISOString(), closedAt: r.closedAt?.toISOString() ?? null }));
  const itemOptions = d.its
    .filter((i) => kind === "reparacion" || i.category === "Lonas")
    .map((i) => ({ id: i.id, name: i.name, category: i.category, free: Number(i.free) - Number(i.repair) }));
  return (
    <>
      <PageHeader icon={Wrench} title="Mantenimiento" subtitle={kind === "limpieza" ? "Limpieza de lonas" : "Reparaciones"} />
      <MaintenanceTabs />
      <PageBody>
        <RepairBoard kind={kind} cards={cards} items={itemOptions} canEdit={d.canEdit} />
      </PageBody>
    </>
  );
}
