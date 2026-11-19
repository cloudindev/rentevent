import { withTenant } from "@rentevent/db";
import { can } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { renderQuotePdf } from "@/server/pdf/quote";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; quoteId: string }> }) {
  const { quoteId } = await params;
  const ctx = await getAppContext();
  if (!ctx || !can(ctx.role, "ver")) return new Response("No autorizado", { status: 401 });
  const pdf = await withTenant(ctx.tenantId, (tx) => renderQuotePdf(tx, quoteId, ctx.tenantName));
  if (!pdf) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(pdf.buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${pdf.fileName}"` } });
}
