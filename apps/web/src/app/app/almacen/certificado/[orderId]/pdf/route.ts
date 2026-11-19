import { NextResponse } from "next/server";
import { withTenant } from "@rentevent/db";
import { can } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { renderCertificatePdf } from "@/server/pdf/certificate";

export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const ctx = await getAppContext();
  if (!ctx || !can(ctx.role, "ver")) return new NextResponse("No autorizado", { status: 403 });
  const { orderId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(orderId)) return new NextResponse("No encontrado", { status: 404 });
  const pdf = await withTenant(ctx.tenantId, (tx) => renderCertificatePdf(tx, orderId, ctx.tenantName));
  if (!pdf) return new NextResponse("No encontrado", { status: 404 });
  return new NextResponse(new Uint8Array(pdf.buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${pdf.fileName}"`, "Cache-Control": "private, no-store" } });
}
