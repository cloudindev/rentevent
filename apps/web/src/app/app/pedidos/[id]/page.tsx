import { notFound } from "next/navigation";
import { can, canSeeField } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { loadOrderWorkspace } from "@/server/orders";
import { OrderWorkspace } from "./workspace";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  void params;
  return { title: "Pedido" };
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data, ctx } = await tenantDb(async (tx, ctx) => ({ data: await loadOrderWorkspace(tx, id), ctx }));
  if (!data) notFound();
  return (
    <OrderWorkspace
      data={data}
      perms={{
        edit: can(ctx.role, "comercial"),
        confirm: can(ctx.role, "confirmar"),
        margin: canSeeField(ctx.role, "margen", ctx.fieldPermissions),
        finance: can(ctx.role, "finanzas"),
      }}
    />
  );
}
