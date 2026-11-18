import { computeBom, type BomLine } from "../tent/bom";
import {
  defaultConfiguration,
  resizeConfiguration,
  type Anchoring,
  type BomItem,
  type BomRule,
  type StructureFamily,
  type TentConfiguration,
} from "../tent/schema";

export type Shortage = { itemId: string; requested: number; available: number; missing: number };

export function shortagesFor(lines: { itemId: string; quantity: number }[], available: Map<string, number>): Shortage[] {
  const req = new Map<string, number>();
  for (const l of lines) req.set(l.itemId, (req.get(l.itemId) ?? 0) + l.quantity);
  const out: Shortage[] = [];
  for (const [itemId, requested] of req) {
    const a = available.get(itemId) ?? 0;
    if (requested > a + 1e-9) out.push({ itemId, requested, available: a, missing: Math.ceil(requested - a) });
  }
  return out;
}

type Catalog = { families: StructureFamily[]; rules: BomRule[]; items: BomItem[] };

function bomLines(config: TentConfiguration, family: StructureFamily, cat: Catalog): BomLine[] {
  return computeBom({ config, family, rules: cat.rules, items: cat.items }).lines;
}

export type MaxLengthResult = {
  familyId: string;
  familyName: string;
  width: number;
  heightClass: StructureFamily["heightClass"];
  maxModules: number;
  maxLength: number;
  label: string;
  limitingItemId: string | null;
};

/**
 * Reverse availability: for a date range (expressed as available units per
 * item) the longest tent each family can still build with a standard
 * configuration.
 */
export function maxLengthByFamily(cat: Catalog, available: Map<string, number>, anchoring: Anchoring = "anclaje"): MaxLengthResult[] {
  return cat.families
    .filter((f) => f.roofShape !== "jaima")
    .map((family) => {
      let best = 0;
      let limiting: string | null = null;
      for (let m = family.minModules; m <= family.maxModules; m++) {
        const config = { ...defaultConfiguration(family, m), anchoring };
        const short = shortagesFor(bomLines(config, family, cat), available);
        if (short.length > 0) {
          limiting = short[0]!.itemId;
          break;
        }
        best = m;
      }
      const maxLength = best * family.moduleLength;
      return {
        familyId: family.id,
        familyName: family.name,
        width: family.width,
        heightClass: family.heightClass,
        maxModules: best,
        maxLength,
        label: best > 0 ? `${family.width}x${maxLength}${family.heightClass === "alta" ? " alta" : ""}` : "no disponible",
        limitingItemId: best === family.maxModules ? null : limiting,
      };
    });
}

export function describeMaxLengths(results: MaxLengthResult[]): string {
  const ok = results.filter((r) => r.maxModules > 0).sort((a, b) => b.maxLength * b.width - a.maxLength * a.width);
  if (ok.length === 0) return "No hay material para montar ninguna carpa en esas fechas.";
  const labels = ok.slice(0, 4).map((r) => r.label);
  const last = labels.pop()!;
  return `Puedes montar hasta ${labels.length ? `${labels.join(", ")} o ${last}` : last}.`;
}

export type Alternative =
  | { kind: "familia"; familyId: string; familyName: string; description: string }
  | { kind: "partir"; parts: { familyId: string; familyName: string; modules: number }[]; description: string }
  | { kind: "fechas"; offsetDays: number; description: string }
  | { kind: "subalquiler"; shortages: Shortage[]; description: string };

/** Moves the configuration to another family keeping per-bay choices. */
export function transferConfiguration(config: TentConfiguration, to: StructureFamily): TentConfiguration {
  const modules = Math.min(to.maxModules, Math.max(to.minModules, config.modules));
  return resizeConfiguration({ ...config, familyId: to.id }, modules);
}

export function suggestAlternatives(input: {
  config: TentConfiguration;
  family: StructureFamily;
  catalog: Catalog;
  available: Map<string, number>;
  /** availability maps for shifted date windows, keyed by day offset */
  shifted?: Map<number, Map<string, number>>;
}): Alternative[] {
  const { config, family, catalog, available } = input;
  const out: Alternative[] = [];
  const base = bomLines(config, family, catalog);
  const shortages = shortagesFor(base, available);
  if (shortages.length === 0) return out;
  const length = config.modules * family.moduleLength;

  const siblings = catalog.families.filter((f) => f.id !== family.id && f.roofShape !== "jaima");
  for (const f of siblings) {
    if (f.width < family.width || config.modules > f.maxModules || config.modules < f.minModules) continue;
    const moved = transferConfiguration(config, f);
    if (shortagesFor(bomLines(moved, f, catalog), available).length === 0) {
      out.push({ kind: "familia", familyId: f.id, familyName: f.name, description: `Usar ${f.name}: ${f.width}x${length}` });
    }
  }

  const sameWidth = siblings.filter((f) => f.width === family.width);
  for (const f of sameWidth) {
    for (let a = Math.max(family.minModules, 1); a < config.modules; a++) {
      const b = config.modules - a;
      if (b < f.minModules || b > f.maxModules) continue;
      const partA = resizeConfiguration(config, a);
      const partB = transferConfiguration(resizeConfiguration(config, b), f);
      const lines = [...bomLines(partA, family, catalog), ...bomLines(partB, f, catalog)];
      if (shortagesFor(lines, available).length === 0) {
        out.push({
          kind: "partir",
          parts: [
            { familyId: family.id, familyName: family.name, modules: a },
            { familyId: f.id, familyName: f.name, modules: b },
          ],
          description: `Partir en ${family.width}x${a * family.moduleLength} (${family.name}) + ${f.width}x${b * f.moduleLength} (${f.name}) unidas con canalón`,
        });
        break;
      }
    }
  }

  if (input.shifted) {
    const offsets = [...input.shifted.keys()].sort((x, y) => Math.abs(x) - Math.abs(y) || x - y);
    for (const off of offsets) {
      if (shortagesFor(base, input.shifted.get(off)!).length === 0) {
        out.push({
          kind: "fechas",
          offsetDays: off,
          description: off > 0 ? `Retrasar ${off} día${off === 1 ? "" : "s"}` : `Adelantar ${-off} día${off === -1 ? "" : "s"}`,
        });
        if (out.filter((o) => o.kind === "fechas").length >= 2) break;
      }
    }
  }

  out.push({
    kind: "subalquiler",
    shortages,
    description: `Subalquilar ${shortages.map((s) => `${s.missing} ud.`).join(", ")} a un proveedor`,
  });
  return out;
}
