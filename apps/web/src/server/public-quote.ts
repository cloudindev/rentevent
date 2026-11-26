import "server-only";
import { and, eq, gt, organization, quotes, systemDb, tenantSettings, type Tx } from "@rentevent/db";

/** Resolves a public quote token (the only secret) to its tenant. */
export async function findQuoteByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [row] = await systemDb()
    .select({ id: quotes.id, tenantId: quotes.tenantId, orderId: quotes.orderId, tenantName: organization.name, logo: tenantSettings.logoUrl })
    .from(quotes)
    .innerJoin(organization, eq(organization.id, quotes.tenantId))
    .leftJoin(tenantSettings, eq(tenantSettings.tenantId, quotes.tenantId))
    .where(eq(quotes.publicToken, token));
  return row ?? null;
}

/** Why a (not yet accepted) quote can no longer be accepted by the client, or null if it can. */
export async function quoteBlock(tx: Tx, q: { orderId: string; version: number; status: string }, orderStatus: string): Promise<string | null> {
  if (orderStatus === "cancelado" || orderStatus === "devuelto") return "Este pedido ya está cerrado. Ponte en contacto con nosotros si quieres retomarlo.";
  if (q.status === "rechazado") return "Este presupuesto ya no está vigente. Pide una versión actualizada.";
  const [newer] = await tx.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.orderId, q.orderId), gt(quotes.version, q.version))).limit(1);
  if (newer) return "Hay una versión más reciente de este presupuesto. Abre el último enlace que te hemos enviado.";
  return null;
}
