import { NextResponse } from "next/server";
import { and, asc, eq, inArray, itemUnits, items, ne, withTenant } from "@rentevent/db";
import { env } from "@/lib/env";
import { can } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { renderLabelsPdf } from "@/server/pdf/labels";

const UUID = /^[0-9a-f-]{36}$/;

/** QR label sheet: ?item=<id> (all its units) and/or ?unit=<id>&unit=<id>… */
export async function GET(req: Request) {
  const ctx = await getAppContext();
  if (!ctx || !can(ctx.role, "ver")) return new NextResponse("No autorizado", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const itemId = sp.get("item");
  const unitIds = sp.getAll("unit").filter((u) => UUID.test(u)).slice(0, 500);
  if ((itemId && !UUID.test(itemId)) || (!itemId && !unitIds.length)) return new NextResponse("Indica un artículo o unidades", { status: 400 });
  const rows = await withTenant(ctx.tenantId, (tx) =>
    tx
      .select({ serial: itemUnits.serial, qrCode: itemUnits.qrCode, itemName: items.name, container: items.container })
      .from(itemUnits)
      .innerJoin(items, eq(items.id, itemUnits.itemId))
      .where(itemId ? and(eq(itemUnits.itemId, itemId), ne(itemUnits.status, "baja")) : inArray(itemUnits.id, unitIds))
      .orderBy(asc(itemUnits.serial))
      .limit(500),
  );
  if (!rows.length) return new NextResponse("No hay unidades", { status: 404 });
  const buffer = await renderLabelsPdf(rows, { appUrl: env.appUrl, tenantName: ctx.tenantName });
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="etiquetas-qr.pdf"`, "Cache-Control": "private, no-store" } });
}
