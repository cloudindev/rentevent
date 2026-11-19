import { computeBom, tentConfigurationSchema, validateConfiguration } from "@rentevent/core";
import { loadCatalog } from "@/server/catalog";
import { ApiError, readJson, withApiKey } from "@/server/api/http";

/** POST /api/v1/bom — computes the bill of materials of a TentConfiguration. */
export async function POST(req: Request) {
  return withApiKey(req, async (tx) => {
    const raw = await readJson(req);
    const parsed = tentConfigurationSchema.safeParse((raw as { configuration?: unknown })?.configuration ?? raw);
    if (!parsed.success) throw new ApiError(422, "validation_error", "TentConfiguration no válida", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    const cat = await loadCatalog(tx);
    const family = cat.families.find((f) => f.id === parsed.data.familyId);
    if (!family) throw new ApiError(404, "family_not_found", "Familia no encontrada");
    const issues = validateConfiguration(parsed.data, family);
    if (issues.length) throw new ApiError(422, "invalid_configuration", issues[0]!.message, issues);
    const r = computeBom({ config: parsed.data, family, rules: cat.rules, items: cat.items, vehicles: cat.vehicles });
    const byId = new Map(cat.items.map((i) => [i.id, i]));
    return {
      family: { id: family.id, name: family.name },
      lines: r.lines.map((l) => ({ item_id: l.itemId, sku: byId.get(l.itemId)?.sku ?? null, name: byId.get(l.itemId)?.name ?? null, quantity: l.quantity, unit: byId.get(l.itemId)?.unit ?? "ud", group: l.group })),
      totals: { weight_kg: r.totals.weightKg, volume_m3: r.totals.volumeM3 },
      metrics: r.metrics,
      labor: r.labor,
      vehicles: r.vehicles,
      errors: r.errors,
    };
  });
}
