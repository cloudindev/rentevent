import { findGutterJoins, placeComposition, detectCollisions } from "../geometry/plan";
import { computeBom, mergeBomLines, type BomLine, type BomResult, type VehicleType } from "./bom";
import type { BomItem, BomRule, Composition, StructureFamily } from "./schema";

export type CompositionBom = {
  tents: { id: string; result: BomResult }[];
  lines: BomLine[];
  totals: { weightKg: number; volumeM3: number; superficie: number; montajeHoras: number; desmontajeHoras: number };
  collisions: { a: string; b: string; depth: number }[];
  gutterCandidates: { a: string; b: string; length: number }[];
  missingFamilies: string[];
};

export function computeCompositionBom(input: {
  composition: Composition;
  families: StructureFamily[];
  rules: BomRule[];
  items: BomItem[];
  vehicles?: VehicleType[];
  gutter?: { itemId: string; unitLength: number } | null;
}): CompositionBom {
  const famById = new Map(input.families.map((f) => [f.id, f]));
  const tents: { id: string; result: BomResult }[] = [];
  const missingFamilies: string[] = [];
  for (const t of input.composition.tents) {
    const family = famById.get(t.config.familyId);
    if (!family) {
      missingFamilies.push(t.config.familyId);
      continue;
    }
    tents.push({ id: t.id, result: computeBom({ config: t.config, family, rules: input.rules, items: input.items, vehicles: input.vehicles }) });
  }
  const groups = tents.map((t) => t.result.lines);
  if (input.gutter && input.composition.gutters.length > 0) {
    const units = input.composition.gutters.reduce((s, g) => s + Math.ceil(g.length / input.gutter!.unitLength - 1e-9), 0);
    if (units > 0) groups.push([{ itemId: input.gutter.itemId, quantity: units, group: "accesorios", ruleIds: ["canalon"] }]);
  }
  const lines = mergeBomLines(groups);
  const weight = lines.reduce((s, l) => s + (input.items.find((i) => i.id === l.itemId)?.weightKg ?? 0) * l.quantity, 0);
  const volume = lines.reduce((s, l) => s + (input.items.find((i) => i.id === l.itemId)?.volumeM3 ?? 0) * l.quantity, 0);
  const placed = placeComposition(input.composition, famById);
  return {
    tents,
    lines,
    totals: {
      weightKg: Math.round(weight * 10) / 10,
      volumeM3: Math.round(volume * 100) / 100,
      superficie: tents.reduce((s, t) => s + t.result.metrics.superficie, 0),
      montajeHoras: Math.round(tents.reduce((s, t) => s + t.result.labor.montajeHoras, 0) * 10) / 10,
      desmontajeHoras: Math.round(tents.reduce((s, t) => s + t.result.labor.desmontajeHoras, 0) * 10) / 10,
    },
    collisions: detectCollisions(placed),
    gutterCandidates: findGutterJoins(placed),
    missingFamilies,
  };
}
