import { loadCatalog } from "@/server/catalog";
import { withApiKey } from "@/server/api/http";

/** GET /api/v1/families — tent families with their BOM rules. */
export async function GET(req: Request) {
  return withApiKey(req, async (tx) => {
    const cat = await loadCatalog(tx);
    return {
      data: cat.families.map((f) => ({
        id: f.id,
        code: f.code,
        name: f.name,
        width: f.width,
        module_length: f.moduleLength,
        eave_height: f.eaveHeight,
        ridge_height: f.ridgeHeight,
        height_class: f.heightClass,
        roof_shape: f.roofShape,
        truss_item_id: f.trussItemId,
        min_modules: f.minModules,
        max_modules: f.maxModules,
        price: f.price,
        price_mode: f.priceMode,
        rules: cat.rules.filter((r) => r.familyId === f.id).map((r) => ({ item_id: r.itemId, formula: r.formula, condition: r.condition, group: r.group })),
      })),
    };
  });
}
