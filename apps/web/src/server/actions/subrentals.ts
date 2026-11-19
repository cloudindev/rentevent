"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, purchases, subrentals } from "@rentevent/db";
import { audit } from "../audit";
import { tenantAction, UserError } from "../action";

const input = z
  .object({
    id: z.string().uuid().nullable(),
    supplierId: z.string().uuid().nullable(),
    itemId: z.string().uuid({ message: "Elige el artículo" }),
    orderId: z.string().uuid().nullable(),
    quantity: z.coerce.number().positive("Cantidad mayor que 0"),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    cost: z.coerce.number().min(0),
    notes: z.string().max(1000).nullable(),
  })
  .refine((d) => d.startsAt < d.endsAt, { message: "La devolución debe ser posterior a la recepción", path: ["endsAt"] });

export const saveSubrental = tenantAction(input, "comercial", async (v, tx, ctx) => {
  const { orders } = await import("@rentevent/db");
  const [o] = v.orderId ? await tx.select().from(orders).where(eq(orders.id, v.orderId)) : [undefined];
  const values = { supplierId: v.supplierId, itemId: v.itemId, orderId: v.orderId, projectId: o?.projectId ?? null, quantity: v.quantity, startsAt: v.startsAt, endsAt: v.endsAt, cost: v.cost, notes: v.notes };
  let id = v.id;
  if (id) await tx.update(subrentals).set(values).where(eq(subrentals.id, id));
  else id = (await tx.insert(subrentals).values(values).returning({ id: subrentals.id }))[0]!.id;
  await audit(tx, ctx, "subrental", id, v.id ? "editar" : "crear");
  revalidatePath("/app/subalquileres");
  return { id };
});

export const setSubrentalStatus = tenantAction(
  z.object({ id: z.string().uuid(), status: z.enum(["solicitado", "confirmado", "recibido", "devuelto", "cancelado"]), receivedQuantity: z.coerce.number().min(0).optional() }),
  "comercial",
  async ({ id, status, receivedQuantity }, tx, ctx) => {
    const [s] = await tx.select().from(subrentals).where(eq(subrentals.id, id));
    if (!s) throw new UserError("Subalquiler no encontrado");
    await tx
      .update(subrentals)
      .set({
        status,
        receivedQuantity: status === "recibido" ? receivedQuantity ?? Number(s.quantity) : s.receivedQuantity,
        receivedAt: status === "recibido" ? new Date() : s.receivedAt,
        returnedAt: status === "devuelto" ? new Date() : s.returnedAt,
      })
      .where(eq(subrentals.id, id));
    await audit(tx, ctx, "subrental", id, "estado", { de: s.status, a: status });
    revalidatePath("/app/subalquileres");
    return { id };
  },
);

/** Registers the supplier invoice for the subrental so its cost is imputed to the project. */
export const purchaseFromSubrental = tenantAction(z.object({ id: z.string().uuid() }), "finanzas", async ({ id }, tx, ctx) => {
  const [s] = await tx.select().from(subrentals).where(eq(subrentals.id, id));
  if (!s) throw new UserError("Subalquiler no encontrado");
  const [existing] = await tx.select().from(purchases).where(eq(purchases.subrentalId, id));
  if (existing) return { id: existing.id };
  const base = Number(s.cost);
  const [p] = await tx
    .insert(purchases)
    .values({ supplierId: s.supplierId, projectId: s.projectId, subrentalId: s.id, issueDate: new Date().toISOString().slice(0, 10), concept: `Subalquiler ${Number(s.quantity)} uds`, category: "subalquiler", base, vat: Math.round(base * 21) / 100, total: Math.round(base * 121) / 100, status: "pendiente" })
    .returning({ id: purchases.id });
  await audit(tx, ctx, "purchase", p!.id, "crear", { subalquiler: id });
  revalidatePath("/app/subalquileres");
  return { id: p!.id };
});
