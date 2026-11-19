import { NextResponse } from "next/server";
import { withTenant } from "@rentevent/db";
import { can } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { renderInvoicePdf } from "@/server/pdf/invoice";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx || !can(ctx.role, "finanzas")) return new NextResponse("No autorizado", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("No encontrado", { status: 404 });
  const pdf = await withTenant(ctx.tenantId, (tx) => renderInvoicePdf(tx, id, ctx.tenantName));
  if (!pdf) return new NextResponse("No encontrado", { status: 404 });
  const inline = new URL(req.url).searchParams.get("descargar") ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline}; filename="${pdf.fileName}"`, "Cache-Control": "private, no-store" },
  });
}
