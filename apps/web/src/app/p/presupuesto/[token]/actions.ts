"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq, orders, quotes, withTenant } from "@rentevent/db";
import { AvailabilityConflictError, reserveOrder } from "@rentevent/db/services";
import { findQuoteByToken, quoteBlock } from "@/server/public-quote";
import { syncProjectStatus } from "@/server/orders";
import { audit } from "@/server/audit";
import { emitEvent } from "@/server/events";

const input = z.object({ token: z.string(), name: z.string().trim().min(3, "Escribe tu nombre completo").max(120), signature: z.string().startsWith("data:image/png;base64,").max(400_000), accept: z.literal(true) });

/** Client acceptance with online signature → confirms the order if stock allows. */
export async function acceptQuote(raw: z.input<typeof input>): Promise<{ ok: boolean; error?: string; confirmed?: boolean }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const q = await findQuoteByToken(parsed.data.token);
  if (!q) return { ok: false, error: "Presupuesto no encontrado" };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return withTenant(q.tenantId, async (tx) => {
    const [row] = await tx.select().from(quotes).where(eq(quotes.id, q.id)).for("update");
    if (!row) return { ok: false, error: "Presupuesto no encontrado" };
    if (row.status === "aceptado") return { ok: true, confirmed: true };
    const [order] = await tx.select().from(orders).where(eq(orders.id, row.orderId)).for("update");
    if (!order) return { ok: false, error: "Presupuesto no encontrado" };
    const blocked = await quoteBlock(tx, row, order.status);
    if (blocked) return { ok: false, error: blocked };
    if (row.validUntil && row.validUntil < new Date().toISOString().slice(0, 10)) return { ok: false, error: "El presupuesto ha caducado. Pide uno actualizado." };
    await tx.update(quotes).set({ status: "aceptado", acceptedAt: new Date(), signatureName: parsed.data.name, signatureImage: parsed.data.signature, signatureIp: ip }).where(eq(quotes.id, q.id));
    await audit(tx, null, "quote", q.id, "aceptar", { firmante: parsed.data.name, ip });
    // an order that is already confirmed or on site keeps its status (and its reservations)
    let confirmed = order.status === "confirmado" || order.status === "en_curso";
    if (!confirmed) {
      try {
        await reserveOrder(tx, row.orderId, "confirmado", { userId: null });
        confirmed = true;
      } catch (e) {
        if (!(e instanceof AvailabilityConflictError)) throw e;
        const note = `Aceptado por el cliente el ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}, pero falta material: revisar antes de confirmar.`;
        await tx.update(orders).set({ notes: order.notes?.trim() ? `${order.notes.trim()}\n\n${note}` : note }).where(eq(orders.id, row.orderId));
      }
      await syncProjectStatus(tx, order.projectId);
    }
    emitEvent(q.tenantId, "quote.accepted", { id: q.id, orderId: row.orderId, signer: parsed.data.name, confirmed });
    if (confirmed && order.status !== "confirmado" && order.status !== "en_curso") emitEvent(q.tenantId, "order.confirmed", { id: row.orderId, via: "aceptacion_cliente" });
    return { ok: true, confirmed };
  });
}
