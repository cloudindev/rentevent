import type { BomLine } from "../tent/bom";
import type { StructureFamily } from "../tent/schema";

export type PriceMode = "unidad" | "dia" | "periodo" | "m2" | "ml" | "incluido" | "hora" | "km";

export const PRICE_MODE_LABELS: Record<PriceMode, string> = {
  unidad: "por unidad",
  dia: "por día",
  periodo: "por periodo",
  m2: "por m²",
  ml: "por metro lineal",
  incluido: "incluido",
  hora: "por hora",
  km: "por km",
};

export type DurationTier = { days: number; factor: number };

export type PricingSettings = {
  vatRate: number;
  durationTiers: DurationTier[];
  /** factor added per day beyond the last tier */
  extraDayFactor: number;
  /** tents are priced per event; days included before extra days are charged */
  tentIncludedDays: number;
  tentExtraDayPct: number;
  holidaySurchargePct: number;
  transportPerKm: number;
  transportMinimum: number;
  transportCostPerKm: number;
  laborPricePerHour: number;
  laborCostPerHour: number;
  /** % of the quote paid to confirm the booking (advance invoice) */
  depositPct: number;
};

export const DEFAULT_PRICING: PricingSettings = {
  vatRate: 21,
  durationTiers: [
    { days: 1, factor: 1 },
    { days: 2, factor: 1.5 },
    { days: 3, factor: 1.8 },
    { days: 7, factor: 2.6 },
  ],
  extraDayFactor: 0.2,
  tentIncludedDays: 3,
  tentExtraDayPct: 8,
  holidaySurchargePct: 20,
  transportPerKm: 1.6,
  transportMinimum: 90,
  transportCostPerKm: 0.95,
  laborPricePerHour: 30,
  laborCostPerHour: 19,
  depositPct: 30,
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Multiplier applied to a daily rate for a rental of `days` days. */
export function durationFactor(days: number, tiers: DurationTier[], extraDayFactor: number): number {
  const d = Math.max(1, Math.ceil(days));
  const sorted = [...tiers].sort((a, b) => a.days - b.days);
  if (sorted.length === 0) return d;
  const exact = sorted.find((t) => t.days === d);
  if (exact) return exact.factor;
  const lower = [...sorted].reverse().find((t) => t.days < d);
  const upper = sorted.find((t) => t.days > d);
  if (!lower) return sorted[0]!.factor;
  if (!upper) return r2(lower.factor + (d - lower.days) * extraDayFactor);
  const t = (d - lower.days) / (upper.days - lower.days);
  return r2(lower.factor + t * (upper.factor - lower.factor));
}

export type LineKind = "carpa" | "articulo" | "servicio" | "transporte" | "mano_obra" | "suplemento" | "texto";

export type PricedLineInput = {
  kind: LineKind;
  quantity: number;
  unitPrice: number;
  priceMode: PriceMode;
  discountPct: number;
  /** unit cost (staff, transport, subrental) for margin */
  unitCost?: number;
  taxRate?: number;
};

export type PricedLine = { gross: number; discount: number; net: number; cost: number; factor: number };

export function priceLine(line: PricedLineInput, ctx: { days: number; holiday: boolean; settings: PricingSettings }): PricedLine {
  if (line.kind === "texto" || line.priceMode === "incluido") return { gross: 0, discount: 0, net: 0, cost: r2((line.unitCost ?? 0) * line.quantity), factor: 0 };
  let factor = 1;
  if (line.priceMode === "dia") factor = durationFactor(ctx.days, ctx.settings.durationTiers, ctx.settings.extraDayFactor);
  if (line.kind === "carpa" && ctx.days > ctx.settings.tentIncludedDays) {
    factor *= 1 + ((ctx.days - ctx.settings.tentIncludedDays) * ctx.settings.tentExtraDayPct) / 100;
  }
  if (ctx.holiday && (line.kind === "carpa" || line.kind === "mano_obra")) factor *= 1 + ctx.settings.holidaySurchargePct / 100;
  const gross = r2(line.quantity * line.unitPrice * factor);
  const discount = r2((gross * Math.min(100, Math.max(0, line.discountPct))) / 100);
  return { gross, discount, net: r2(gross - discount), cost: r2((line.unitCost ?? 0) * line.quantity), factor: r2(factor) };
}

export type QuoteTotals = {
  gross: number;
  lineDiscounts: number;
  globalDiscount: number;
  taxable: number;
  vat: number;
  total: number;
  cost: number;
  margin: number;
  marginPct: number;
  vatBreakdown: { rate: number; base: number; amount: number }[];
};

export function quoteTotals(
  lines: PricedLineInput[],
  ctx: { days: number; holiday: boolean; settings: PricingSettings; globalDiscountPct?: number },
): QuoteTotals {
  const priced = lines.map((l) => ({ l, p: priceLine(l, ctx) }));
  const gross = r2(priced.reduce((s, x) => s + x.p.gross, 0));
  const lineDiscounts = r2(priced.reduce((s, x) => s + x.p.discount, 0));
  const net = r2(gross - lineDiscounts);
  const g = Math.min(100, Math.max(0, ctx.globalDiscountPct ?? 0)) / 100;
  const globalDiscount = r2(net * g);
  const taxable = r2(net - globalDiscount);
  const byRate = new Map<number, number>();
  for (const { l, p } of priced) {
    const rate = l.taxRate ?? ctx.settings.vatRate;
    byRate.set(rate, (byRate.get(rate) ?? 0) + p.net * (1 - g));
  }
  const vatBreakdown = [...byRate.entries()].map(([rate, base]) => ({ rate, base: r2(base), amount: r2((base * rate) / 100) }));
  const vat = r2(vatBreakdown.reduce((s, v) => s + v.amount, 0));
  const cost = r2(priced.reduce((s, x) => s + x.p.cost, 0));
  const margin = r2(taxable - cost);
  return {
    gross,
    lineDiscounts,
    globalDiscount,
    taxable,
    vat,
    total: r2(taxable + vat),
    cost,
    margin,
    marginPct: taxable > 0 ? r2((margin / taxable) * 100) : 0,
    vatBreakdown,
  };
}

export type TentPricingInput = {
  family: Pick<StructureFamily, "id" | "name" | "width" | "moduleLength">;
  modules: number;
  pricing: { mode: "m2" | "ml"; price: number };
  bomLines: BomLine[];
  itemPrices: Map<string, { name: string; price: number; priceMode: PriceMode }>;
};

/** Turns a configured tent into quote lines: the base tent plus priced extras. */
export function tentQuoteLines(input: TentPricingInput): (PricedLineInput & { description: string; itemId: string | null })[] {
  const largo = input.modules * input.family.moduleLength;
  const qty = input.pricing.mode === "m2" ? largo * input.family.width : largo;
  const out: (PricedLineInput & { description: string; itemId: string | null })[] = [
    {
      kind: "carpa",
      description: `${input.family.name} ${input.family.width}x${largo} m`,
      itemId: null,
      quantity: qty,
      unitPrice: input.pricing.price,
      priceMode: input.pricing.mode,
      discountPct: 0,
    },
  ];
  for (const l of input.bomLines) {
    const p = input.itemPrices.get(l.itemId);
    if (!p || p.priceMode === "incluido" || p.price === 0) continue;
    out.push({
      kind: "suplemento",
      description: p.name,
      itemId: l.itemId,
      quantity: l.quantity,
      unitPrice: p.price,
      priceMode: p.priceMode,
      discountPct: 0,
    });
  }
  return out;
}

export function transportLine(distanceKm: number, trips: number, settings: PricingSettings): PricedLineInput & { description: string } {
  const km = Math.max(0, distanceKm) * 2 * Math.max(1, trips);
  const price = Math.max(settings.transportMinimum, km * settings.transportPerKm);
  return {
    kind: "transporte",
    description: `Transporte ${Math.round(distanceKm)} km × ${Math.max(1, trips)} viaje${trips > 1 ? "s" : ""} (ida y vuelta)`,
    quantity: 1,
    unitPrice: r2(price),
    priceMode: "unidad",
    discountPct: 0,
    unitCost: r2(km * settings.transportCostPerKm),
  };
}

export function laborLine(hours: number, settings: PricingSettings, label = "Montaje y desmontaje"): PricedLineInput & { description: string } {
  return {
    kind: "mano_obra",
    description: `${label} (${r2(hours)} h)`,
    quantity: r2(hours),
    unitPrice: settings.laborPricePerHour,
    priceMode: "hora",
    discountPct: 0,
    unitCost: settings.laborCostPerHour,
  };
}

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Road distance estimate from straight-line distance (rural Asturias factor). */
export const roadKm = (straightKm: number) => Math.round(straightKm * 1.3 * 10) / 10;
