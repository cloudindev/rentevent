import { asc, gt, items } from "@rentevent/db";
import { page, pageParams, withApiKey } from "@/server/api/http";

/** GET /api/v1/items — inventory items. */
export async function GET(req: Request) {
  const { limit, cursor } = pageParams(req);
  return withApiKey(req, async (tx) => {
    const rows = await tx
      .select({ id: items.id, sku: items.sku, name: items.name, category: items.category, kind: items.kind, unit: items.unit, stock_total: items.stockTotal, stock_repair: items.stockRepair, weight_kg: items.weightKg, volume_m3: items.volumeM3, price: items.price, price_mode: items.priceMode, active: items.active })
      .from(items)
      .where(cursor ? gt(items.id, cursor) : undefined)
      .orderBy(asc(items.id))
      .limit(limit + 1);
    return page(rows, limit);
  });
}
