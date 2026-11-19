import { withTenant } from "@rentevent/db";
import { findQuoteByToken } from "@/server/public-quote";
import { renderQuotePdf } from "@/server/pdf/quote";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const q = await findQuoteByToken(token);
  if (!q) return new Response("No encontrado", { status: 404 });
  const pdf = await withTenant(q.tenantId, (tx) => renderQuotePdf(tx, q.id, q.tenantName));
  if (!pdf) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(pdf.buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${pdf.fileName}"`, "X-Robots-Tag": "noindex" } });
}
