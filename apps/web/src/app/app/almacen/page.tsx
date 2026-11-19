import { redirect } from "next/navigation";
import { and, eq, orders, pickLists } from "@rentevent/db";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { createPickList } from "@/server/warehouse/picklists";
import { PickListsView } from "./lists-view";

export const metadata = { title: "Almacén" };

export default async function AlmacenPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const { pedido } = await searchParams;
  if (pedido && /^[0-9a-f-]{36}$/.test(pedido)) {
    const target = await tenantDb(async (tx, ctx) => {
      const [o] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, pedido));
      if (!o) return null;
      const kind = o.status === "en_curso" || o.status === "devuelto" ? "retorno" : "salida";
      const [existing] = await tx.select({ id: pickLists.id }).from(pickLists).where(and(eq(pickLists.orderId, pedido), eq(pickLists.kind, kind)));
      if (existing) return existing.id;
      if (!can(ctx.role, "almacen")) return null;
      try {
        return await createPickList(tx, ctx, pedido, kind);
      } catch {
        return null;
      }
    });
    if (target) redirect(`/app/almacen/${target}`);
  }
  return <PickListsView kind="salida" />;
}
