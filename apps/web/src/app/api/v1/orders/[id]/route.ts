import { asc, eq, orderLines, orders } from "@rentevent/db";
import { ApiError, withApiKey } from "@/server/api/http";

/** GET /api/v1/orders/:id — order with its lines (BOM sub-lines flagged from_bom). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiKey(req, async (tx) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Pedido no encontrado");
    const [o] = await tx.select().from(orders).where(eq(orders.id, id));
    if (!o) throw new ApiError(404, "not_found", "Pedido no encontrado");
    const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, id)).orderBy(asc(orderLines.sortOrder));
    return {
      id: o.id,
      number: o.number,
      title: o.title,
      status: o.status,
      client_id: o.clientId,
      project_id: o.projectId,
      period: { start: o.periodStart, end: o.periodEnd },
      event: { start: o.eventStart, end: o.eventEnd },
      option_expires_at: o.optionExpiresAt,
      lines: lines.map((l) => ({ id: l.id, parent_id: l.parentLineId, kind: l.kind, item_id: l.itemId, description: l.description, quantity: Number(l.quantity), unit_price: Number(l.unitPrice), price_mode: l.priceMode, discount_pct: Number(l.discountPct), from_bom: l.fromBom })),
    };
  });
}
