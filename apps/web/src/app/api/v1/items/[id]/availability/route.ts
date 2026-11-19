import { eq, items } from "@rentevent/db";
import { availableMap } from "@rentevent/db/services";
import { ApiError, withApiKey } from "@/server/api/http";

/** GET /api/v1/items/:id/availability?from=ISO&to=ISO — peak availability in the range. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = new URL(req.url);
  return withApiKey(req, async (tx) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "not_found", "Artículo no encontrado");
    const from = new Date(u.searchParams.get("from") ?? "");
    const to = new Date(u.searchParams.get("to") ?? "");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) throw new ApiError(400, "invalid_range", "Indica from y to en ISO 8601 con to > from");
    const [it] = await tx.select({ id: items.id, total: items.stockTotal, repair: items.stockRepair }).from(items).where(eq(items.id, id));
    if (!it) throw new ApiError(404, "not_found", "Artículo no encontrado");
    const m = await availableMap(tx, [id], { start: from, end: to });
    return { item_id: id, from: from.toISOString(), to: to.toISOString(), stock_total: Number(it.total), in_repair: Number(it.repair), available: m.get(id) ?? 0 };
  });
}
