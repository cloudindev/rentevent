import "server-only";
import { eq, organization, quotes, systemDb, tenantSettings } from "@rentevent/db";

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
