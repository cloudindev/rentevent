import "server-only";
import { bomRules, items, structureFamilies, type Tx } from "@rentevent/db";
import { fixtureFamilies, fixtureItems, fixturePricePerM2, fixtureRules } from "@rentevent/core/fixtures/asturias";

export const TEMPLATE_WIDTHS = [7, 10, 14, 15, 20] as const;

/**
 * Installs the example tent catalogue (families, items and BOM rules) with
 * fresh UUIDs. Stock figures are reset to 0 except when keepStock is true,
 * so a new company enters its own quantities. Optionally limited to widths.
 */
export async function installExampleCatalogue(tx: Tx, opts: { widths?: number[]; includeJaima?: boolean; keepStock?: boolean } = {}) {
  const widths = new Set(opts.widths?.length ? opts.widths : TEMPLATE_WIDTHS);
  const families = fixtureFamilies.filter((f) => (f.roofShape === "jaima" ? opts.includeJaima !== false : widths.has(f.width)));
  const rules = fixtureRules.filter((r) => families.some((f) => f.id === r.familyId));
  const neededItems = new Set([...rules.map((r) => r.itemId), ...families.map((f) => f.trussItemId).filter(Boolean) as string[]]);
  const existing = await tx.select({ id: items.id, sku: items.sku }).from(items);
  const bySku = new Map(existing.map((e) => [e.sku, e.id]));
  const idMap = new Map<string, string>();
  let createdItems = 0;
  for (const it of fixtureItems) {
    if (!neededItems.has(it.id) && it.role !== "otro" && it.role !== "canalon") continue;
    const found = bySku.get(it.sku);
    if (found) {
      idMap.set(it.id, found);
      continue;
    }
    const [row] = await tx
      .insert(items)
      .values({ sku: it.sku, name: it.name, category: it.category, kind: it.kind, unit: it.unit, role: it.role, roleAmount: it.roleAmount ?? 1, weightKg: it.weightKg, volumeM3: it.volumeM3, price: it.price, priceMode: it.priceMode, stockTotal: opts.keepStock ? it.stock : 0, pendingValidation: true })
      .returning({ id: items.id });
    idMap.set(it.id, row!.id);
    createdItems++;
  }
  const famMap = new Map<string, string>();
  for (const [i, f] of families.entries()) {
    const [row] = await tx
      .insert(structureFamilies)
      .values({ code: f.code, name: f.name, width: f.width, moduleLength: f.moduleLength, eaveHeight: f.eaveHeight, ridgeHeight: f.ridgeHeight, heightClass: f.heightClass, roofShape: f.roofShape, trussItemId: f.trussItemId ? idMap.get(f.trussItemId) ?? null : null, minModules: f.minModules, maxModules: f.maxModules, parameters: f.parameters, labor: f.labor, priceMode: "m2", price: fixturePricePerM2[f.id] ?? 0, sortOrder: i, parametersPending: true })
      .onConflictDoNothing()
      .returning({ id: structureFamilies.id });
    if (row) famMap.set(f.id, row.id);
  }
  const ruleRows = rules.filter((r) => famMap.has(r.familyId) && idMap.has(r.itemId)).map((r) => ({ familyId: famMap.get(r.familyId)!, itemId: idMap.get(r.itemId)!, formula: r.formula, condition: r.condition, group: r.group, sortOrder: r.sortOrder, note: r.note }));
  if (ruleRows.length) await tx.insert(bomRules).values(ruleRows);
  return { families: famMap.size, items: createdItems, rules: ruleRows.length };
}
