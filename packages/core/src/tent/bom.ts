import { evaluateBoolean, evaluateNumber, FormulaError, type Scope } from "../expr";
import type { BomGroup, BomItem, BomRule, StructureFamily, TentConfiguration } from "./schema";
import { computeVariables } from "./variables";

export type BomLine = {
  itemId: string;
  quantity: number;
  group: BomGroup;
  ruleIds: string[];
};

export type BomError = { ruleId: string; itemId: string; message: string };

export type VehicleType = { id: string; name: string; maxPayloadKg: number; volumeM3: number };
export type VehicleNeed = { vehicleId: string; name: string; count: number };

export type CapacityRatios = { coctelM2: number; banqueteM2: number; teatroM2: number };
export const DEFAULT_CAPACITY: CapacityRatios = { coctelM2: 0.8, banqueteM2: 1.4, teatroM2: 0.9 };

export type BomResult = {
  lines: BomLine[];
  errors: BomError[];
  variables: Scope;
  totals: { weightKg: number; volumeM3: number };
  metrics: {
    largo: number;
    ancho: number;
    superficie: number;
    perimetro: number;
    aforo: { coctel: number; banquete: number; teatro: number };
    plazas: number;
  };
  vehicles: VehicleNeed[];
  labor: { montajeHoras: number; desmontajeHoras: number; personas: number; montajeHorasReloj: number };
};

/** Rounds rule results up to whole units; area items keep two decimals. */
function roundQuantity(q: number, unit: string): number {
  if (q <= 0) return 0;
  if (unit === "m2" || unit === "m" || unit === "ml") return Math.round(q * 100) / 100;
  return Math.ceil(q - 1e-9);
}

export function evaluateRules(
  rules: BomRule[],
  scope: Scope,
  itemsById: Map<string, BomItem>,
): { lines: BomLine[]; errors: BomError[] } {
  const errors: BomError[] = [];
  const byItem = new Map<string, BomLine>();
  const sorted = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const rule of sorted) {
    try {
      if (!evaluateBoolean(rule.condition, scope)) continue;
      const item = itemsById.get(rule.itemId);
      const raw = evaluateNumber(rule.formula, scope);
      const q = roundQuantity(raw, item?.unit ?? "ud");
      if (q <= 0) continue;
      const existing = byItem.get(rule.itemId);
      if (existing) {
        existing.quantity = roundQuantity(existing.quantity + q, item?.unit ?? "ud");
        existing.ruleIds.push(rule.id);
      } else {
        byItem.set(rule.itemId, { itemId: rule.itemId, quantity: q, group: rule.group, ruleIds: [rule.id] });
      }
    } catch (e) {
      errors.push({
        ruleId: rule.id,
        itemId: rule.itemId,
        message: e instanceof FormulaError ? e.message : String(e),
      });
    }
  }
  return { lines: [...byItem.values()], errors };
}

export function vehiclesFor(weightKg: number, volumeM3: number, vehicles: VehicleType[]): VehicleNeed[] {
  return vehicles
    .filter((v) => v.maxPayloadKg > 0 && v.volumeM3 > 0)
    .map((v) => ({
      vehicleId: v.id,
      name: v.name,
      count: weightKg <= 0 && volumeM3 <= 0 ? 0 : Math.max(Math.ceil(weightKg / v.maxPayloadKg), Math.ceil(volumeM3 / v.volumeM3)),
    }))
    .sort((a, b) => a.count - b.count);
}

export function estimateLabor(scope: Scope, family: StructureFamily, weightCount: number) {
  const r = family.labor;
  const n = (k: string) => Number(scope[k] ?? 0);
  const minutes =
    n("porticos") * r.minPorPortico +
    n("tramos_con_techo") * r.minPorLonaTecho +
    n("laterales.cerrados") * r.minPorLateral +
    n("frentes.con_pico") * r.minPorFrente +
    (n("superficie_tarima") + n("superficie_suelo") + n("superficie_moqueta")) * r.minPorM2Suelo +
    weightCount * r.minPorPeso;
  const montajeHoras = Math.round((minutes / 60) * 10) / 10;
  const desmontajeHoras = Math.round(montajeHoras * r.factorDesmontaje * 10) / 10;
  // crew size grows with job size: one extra person every 8 person-hours
  const personas = Math.max(r.personasMinimas, Math.min(20, Math.ceil(montajeHoras / 8) + 2));
  const montajeHorasReloj = Math.round((montajeHoras / personas) * 10) / 10;
  return { montajeHoras, desmontajeHoras, personas, montajeHorasReloj };
}

export function computeBom(input: {
  config: TentConfiguration;
  family: StructureFamily;
  rules: BomRule[];
  items: BomItem[];
  vehicles?: VehicleType[];
  capacity?: CapacityRatios;
}): BomResult {
  const { config, family } = input;
  const itemsById = new Map(input.items.map((i) => [i.id, i]));
  const scope = computeVariables(config, family);
  const familyRules = input.rules.filter((r) => r.familyId === family.id);
  const { lines, errors } = evaluateRules(familyRules, scope, itemsById);

  let weightKg = 0;
  let volumeM3 = 0;
  let weightCount = 0;
  for (const l of lines) {
    const item = itemsById.get(l.itemId);
    if (!item) continue;
    weightKg += item.weightKg * l.quantity;
    volumeM3 += item.volumeM3 * l.quantity;
    if (item.role === "peso") weightCount += l.quantity;
  }
  weightKg = Math.round(weightKg * 10) / 10;
  volumeM3 = Math.round(volumeM3 * 100) / 100;

  const cap = input.capacity ?? DEFAULT_CAPACITY;
  const superficie = Number(scope.superficie);
  return {
    lines,
    errors,
    variables: scope,
    totals: { weightKg, volumeM3 },
    metrics: {
      largo: Number(scope.largo),
      ancho: Number(scope.ancho),
      superficie,
      perimetro: Number(scope.perimetro),
      aforo: {
        coctel: Math.floor(superficie / cap.coctelM2),
        banquete: Math.floor(superficie / cap.banqueteM2),
        teatro: Math.floor(superficie / cap.teatroM2),
      },
      plazas: Number(scope.plazas),
    },
    vehicles: vehiclesFor(weightKg, volumeM3, input.vehicles ?? []),
    labor: estimateLabor(scope, family, weightCount),
  };
}

/** Sums several BOMs (a composition) by item. */
export function mergeBomLines(groups: BomLine[][]): BomLine[] {
  const map = new Map<string, BomLine>();
  for (const lines of groups) {
    for (const l of lines) {
      const e = map.get(l.itemId);
      if (e) {
        e.quantity = Math.round((e.quantity + l.quantity) * 100) / 100;
        e.ruleIds = [...new Set([...e.ruleIds, ...l.ruleIds])];
      } else map.set(l.itemId, { ...l, ruleIds: [...l.ruleIds] });
    }
  }
  return [...map.values()];
}
