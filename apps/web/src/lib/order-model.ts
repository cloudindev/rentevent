/**
 * Order workspace model shared by the client (instant feedback) and the
 * server (definitive validation). Pure: no React, no DB.
 */
import {
  computeCompositionBom,
  priceLine,
  quoteTotals,
  tentQuoteLines,
  type BomItem,
  type BomRule,
  type Composition,
  type PricedLineInput,
  type PriceMode,
  type PricingSettings,
  type StructureFamily,
  type VehicleType,
} from "@rentevent/core";

export type FamilyLite = StructureFamily & { price: number; priceMode: "m2" | "ml" };
export type ItemLite = BomItem & { price: number; priceMode: PriceMode; costPrice: number; category: string; kind: string; stockTotal: number; stockRepair: number };
export type KitLite = { id: string; sku: string; name: string; price: number; items: { itemId: string; quantity: number }[] };

export type TentLine = {
  key: string;
  kind: "carpa";
  tentConfigId: string | null;
  label: string;
  composition: Composition;
  /** price override per m² / ml; null = family price */
  unitPrice: number | null;
  discountPct: number;
};
export type ItemLine = { key: string; kind: "articulo"; itemId: string; description: string; quantity: number; unitPrice: number; priceMode: PriceMode; discountPct: number };
export type KitLine = { key: string; kind: "kit"; kitId: string; description: string; quantity: number; unitPrice: number; discountPct: number };
export type ServiceLine = { key: string; kind: "servicio" | "transporte" | "mano_obra" | "texto"; description: string; quantity: number; unitPrice: number; priceMode: PriceMode; discountPct: number; unitCost: number };
export type WorkLine = TentLine | ItemLine | KitLine | ServiceLine;

export type Catalogue = { families: FamilyLite[]; rules: BomRule[]; items: ItemLite[]; vehicles: VehicleType[]; kits: KitLite[]; gutter: { itemId: string; unitLength: number } | null };

export type PricedRow = PricedLineInput & { description: string; lineKey: string; itemId: string | null; parent: boolean };

/** Expands work lines into material requirements (by item). */
export function materialOf(lines: WorkLine[], cat: Catalogue) {
  const req = new Map<string, number>();
  const untracked = new Set(cat.items.filter((i) => i.kind === "servicio").map((i) => i.id));
  const add = (id: string, q: number) => {
    if (!untracked.has(id)) req.set(id, Math.round(((req.get(id) ?? 0) + q) * 100) / 100);
  };
  const boms = new Map<string, ReturnType<typeof computeCompositionBom>>();
  for (const l of lines) {
    if (l.kind === "carpa") {
      const b = computeCompositionBom({ composition: l.composition, families: cat.families, rules: cat.rules, items: cat.items, vehicles: cat.vehicles, gutter: cat.gutter });
      boms.set(l.key, b);
      b.lines.forEach((x) => add(x.itemId, x.quantity));
    } else if (l.kind === "articulo") add(l.itemId, l.quantity);
    else if (l.kind === "kit") cat.kits.find((k) => k.id === l.kitId)?.items.forEach((i) => add(i.itemId, i.quantity * l.quantity));
  }
  return { requirements: [...req.entries()].map(([itemId, quantity]) => ({ itemId, quantity })), boms };
}

/** Priced rows (what the client pays) for totals and the quote. */
export function pricedRows(lines: WorkLine[], cat: Catalogue, boms: Map<string, ReturnType<typeof computeCompositionBom>>): PricedRow[] {
  const out: PricedRow[] = [];
  const itemPrices = new Map(cat.items.map((i) => [i.id, { name: i.name, price: i.price, priceMode: i.priceMode }]));
  for (const l of lines) {
    if (l.kind === "carpa") {
      const bom = boms.get(l.key);
      l.composition.tents.forEach((t) => {
        const fam = cat.families.find((f) => f.id === t.config.familyId);
        if (!fam) return;
        const tentBom = bom?.tents.find((x) => x.id === t.id)?.result.lines ?? [];
        const rows = tentQuoteLines({ family: fam, modules: fam.roofShape === "jaima" ? 1 : t.config.modules, pricing: { mode: fam.priceMode, price: l.unitPrice ?? fam.price }, bomLines: tentBom, itemPrices });
        if (fam.roofShape === "jaima") rows.shift();
        rows.forEach((r, i) => out.push({ ...r, discountPct: l.discountPct, lineKey: l.key, parent: i === 0 && fam.roofShape !== "jaima", description: i === 0 && t.label ? `${r.description} · ${t.label}` : r.description }));
      });
      const gutterLine = bom?.lines.find((x) => x.itemId === cat.gutter?.itemId);
      const gutterItem = cat.gutter ? cat.items.find((i) => i.id === cat.gutter!.itemId) : null;
      if (gutterLine && gutterItem && gutterItem.price > 0) out.push({ kind: "suplemento", description: gutterItem.name, itemId: gutterItem.id, quantity: gutterLine.quantity, unitPrice: gutterItem.price, priceMode: gutterItem.priceMode, discountPct: l.discountPct, lineKey: l.key, parent: false });
    } else if (l.kind === "articulo") {
      const it = cat.items.find((i) => i.id === l.itemId);
      out.push({ kind: "articulo", description: l.description, itemId: l.itemId, quantity: l.quantity, unitPrice: l.unitPrice, priceMode: l.priceMode, discountPct: l.discountPct, unitCost: it?.costPrice ?? 0, lineKey: l.key, parent: true });
    } else if (l.kind === "kit") {
      out.push({ kind: "articulo", description: l.description, itemId: null, quantity: l.quantity, unitPrice: l.unitPrice, priceMode: "unidad", discountPct: l.discountPct, lineKey: l.key, parent: true });
    } else {
      out.push({ kind: l.kind === "servicio" ? "servicio" : l.kind, description: l.description, itemId: null, quantity: l.quantity, unitPrice: l.unitPrice, priceMode: l.priceMode, discountPct: l.discountPct, unitCost: l.unitCost, lineKey: l.key, parent: true });
    }
  }
  return out;
}

export function orderTotals(lines: WorkLine[], cat: Catalogue, ctx: { days: number; holiday: boolean; settings: PricingSettings; globalDiscountPct: number }) {
  const { requirements, boms } = materialOf(lines, cat);
  const rows = pricedRows(lines, cat, boms);
  const rowNet = new Map<string, number>();
  for (const r of rows) rowNet.set(r.lineKey, Math.round(((rowNet.get(r.lineKey) ?? 0) + priceLine(r, ctx).net) * 100) / 100);
  return { requirements, boms, rows, rowNet, totals: quoteTotals(rows, ctx) };
}

export function tentLabel(l: TentLine, cat: Catalogue): string {
  if (l.label) return l.label;
  const t = l.composition.tents[0];
  const f = t ? cat.families.find((x) => x.id === t.config.familyId) : null;
  if (!f || !t) return "Carpa";
  return f.roofShape === "jaima" ? f.name : `${f.name} ${f.width}x${t.config.modules * f.moduleLength}`;
}

export const newKey = () => Math.random().toString(36).slice(2, 10);
