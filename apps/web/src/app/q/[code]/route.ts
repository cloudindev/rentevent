import { NextResponse } from "next/server";
import { eq, items, withTenant } from "@rentevent/db";
import { getAppContext } from "@/server/context";
import { findUnitByCode } from "@/server/warehouse/tracking";

/**
 * Target of printed QR labels. Opens the unit's page (or the item, for a SKU);
 * without a session, goes through the login and comes back here.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(req.url);
  const ctx = await getAppContext();
  if (!ctx) return NextResponse.redirect(new URL(`/acceso?next=${encodeURIComponent(url.pathname)}`, url));
  const dest = await withTenant(ctx.tenantId, async (tx) => {
    const hit = await findUnitByCode(tx, decodeURIComponent(code));
    if (hit) return `/app/inventario/unidades/${hit.unit.id}`;
    const [item] = await tx.select({ id: items.id }).from(items).where(eq(items.sku, decodeURIComponent(code)));
    return item ? `/app/inventario/${item.id}` : null;
  });
  if (!dest) return NextResponse.redirect(new URL(`/app/inventario/unidades?q=${encodeURIComponent(code)}`, url));
  // crew members without back-office access see the unit in the mobile scanner instead
  return NextResponse.redirect(new URL(ctx.role === "montador" ? `/m/escanear?codigo=${encodeURIComponent(code)}` : dest, url));
}
