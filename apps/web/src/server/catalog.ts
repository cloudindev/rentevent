import "server-only";
import { asc, bomRules, eq, items, structureFamilies, vehicles, type Tx } from "@rentevent/db";
import { DEFAULT_LABOR, type BomItem, type BomRule, type LaborRatios, type PartRole, type StructureFamily, type VehicleType } from "@rentevent/core";
import type { PriceMode } from "@rentevent/core";

export type CatalogItem = BomItem & {
  category: string;
  kind: string;
  price: number;
  priceMode: PriceMode;
  costPrice: number;
  stockTotal: number;
  stockRepair: number;
  location: string | null;
};

export type CatalogFamily = StructureFamily & { price: number; priceMode: "m2" | "ml"; active: boolean; parametersPending: boolean };

export type Catalog = {
  families: CatalogFamily[];
  rules: BomRule[];
  items: CatalogItem[];
  vehicles: VehicleType[];
};

/** Loads everything the BOM engine, the 3D viewer and pricing need (tenant-scoped). */
export async function loadCatalog(tx: Tx, opts: { includeInactive?: boolean } = {}): Promise<Catalog> {
  const [fams, rules, its, vehs] = await Promise.all([
    tx.select().from(structureFamilies).orderBy(asc(structureFamilies.sortOrder), asc(structureFamilies.width)),
    tx.select().from(bomRules).orderBy(asc(bomRules.sortOrder)),
    tx.select().from(items).where(opts.includeInactive ? undefined : eq(items.active, true)),
    tx.select().from(vehicles).where(eq(vehicles.active, true)),
  ]);
  return {
    families: fams
      .filter((f) => opts.includeInactive || f.active)
      .map((f) => ({
        id: f.id,
        code: f.code,
        name: f.name,
        width: f.width,
        moduleLength: f.moduleLength,
        eaveHeight: f.eaveHeight,
        ridgeHeight: f.ridgeHeight,
        heightClass: f.heightClass as StructureFamily["heightClass"],
        roofShape: f.roofShape as StructureFamily["roofShape"],
        trussItemId: f.trussItemId,
        minModules: f.minModules,
        maxModules: f.maxModules,
        parameters: f.parameters ?? {},
        labor: { ...DEFAULT_LABOR, ...((f.labor as Partial<LaborRatios>) ?? {}) },
        price: Number(f.price),
        priceMode: (f.priceMode as "m2" | "ml") ?? "m2",
        active: f.active,
        parametersPending: f.parametersPending,
      })),
    rules: rules.map((r) => ({
      id: r.id,
      familyId: r.familyId,
      itemId: r.itemId,
      formula: r.formula,
      condition: r.condition,
      group: r.group as BomRule["group"],
      sortOrder: r.sortOrder,
      note: r.note,
    })),
    items: its.map((i) => ({
      id: i.id,
      name: i.name,
      sku: i.sku,
      unit: i.unit,
      weightKg: i.weightKg,
      volumeM3: i.volumeM3,
      role: i.role as PartRole,
      roleAmount: i.roleAmount,
      category: i.category,
      kind: i.kind,
      price: Number(i.price),
      priceMode: i.priceMode as PriceMode,
      costPrice: Number(i.costPrice),
      stockTotal: Number(i.stockTotal),
      stockRepair: Number(i.stockRepair),
      location: i.location,
    })),
    vehicles: vehs.map((v) => ({ id: v.id, name: v.name, maxPayloadKg: v.maxPayloadKg, volumeM3: v.volumeM3 })),
  };
}
