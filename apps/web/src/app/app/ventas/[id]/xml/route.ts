import { NextResponse } from "next/server";
import { withTenant } from "@rentevent/db";
import { can } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { buildFacturaeXml } from "@/server/finance/einvoice";

/** Facturae-like XML of an issued invoice (simulated e-invoice provider). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx || !can(ctx.role, "finanzas")) return new NextResponse("No autorizado", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("No encontrado", { status: 404 });
  try {
    const { xml, fileName } = await withTenant(ctx.tenantId, (tx) => buildFacturaeXml(tx, id));
    return new NextResponse(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName}"` } });
  } catch {
    return new NextResponse("La factura no está emitida", { status: 409 });
  }
}
