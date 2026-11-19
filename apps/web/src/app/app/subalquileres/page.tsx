import { ArrowLeftRight } from "lucide-react";
import { asc, contacts, desc, eq, gt, items, orders, purchases, subrentals } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { SubrentalsBoard } from "./board";

export const metadata = { title: "Subalquileres" };

export default async function SubrentalsPage() {
  const d = await tenantDb(async (tx, ctx) => ({
    rows: await tx
      .select({ s: subrentals, supplier: contacts.name, item: items.name, order: orders.title, orderNumber: orders.number, purchaseId: purchases.id })
      .from(subrentals)
      .leftJoin(contacts, eq(contacts.id, subrentals.supplierId))
      .innerJoin(items, eq(items.id, subrentals.itemId))
      .leftJoin(orders, eq(orders.id, subrentals.orderId))
      .leftJoin(purchases, eq(purchases.subrentalId, subrentals.id))
      .orderBy(desc(subrentals.startsAt)),
    suppliers: await tx.select({ id: contacts.id, name: contacts.name }).from(contacts).where(eq(contacts.kind, "proveedor")).orderBy(asc(contacts.name)),
    items: await tx.select({ id: items.id, name: items.name }).from(items).where(eq(items.active, true)).orderBy(asc(items.name)),
    orders: await tx.select({ id: orders.id, number: orders.number, title: orders.title, s: orders.periodStart, e: orders.periodEnd }).from(orders).where(gt(orders.periodEnd, new Date(Date.now() - 30 * 86_400_000))).orderBy(asc(orders.periodStart)),
    role: ctx.role,
  }));
  return (
    <>
      <PageHeader icon={ArrowLeftRight} title="Subalquileres" subtitle="Material alquilado a terceros para cubrir escaseces" />
      <PageBody>
        <SubrentalsBoard
          rows={d.rows.map((r) => ({ id: r.s.id, supplierId: r.s.supplierId, supplier: r.supplier ?? "Sin proveedor", itemId: r.s.itemId, item: r.item, orderId: r.s.orderId, order: r.order ? `${r.orderNumber} · ${r.order}` : null, quantity: Number(r.s.quantity), received: Number(r.s.receivedQuantity), startsAt: r.s.startsAt.toISOString(), endsAt: r.s.endsAt.toISOString(), cost: Number(r.s.cost), status: r.s.status, notes: r.s.notes, purchaseId: r.purchaseId }))}
          suppliers={d.suppliers}
          items={d.items}
          orders={d.orders.map((o) => ({ id: o.id, label: `${o.number} · ${o.title}`, s: o.s.toISOString(), e: o.e.toISOString() }))}
          canEdit={can(d.role, "comercial")}
          canFinance={can(d.role, "finanzas")}
        />
      </PageBody>
    </>
  );
}
