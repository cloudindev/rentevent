import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING, durationFactor, haversineKm, laborLine, priceLine, quoteTotals, roadKm, tentQuoteLines, transportLine } from ".";

const ctx = { days: 1, holiday: false, settings: DEFAULT_PRICING };

describe("pricing", () => {
  it("duration factor interpolates and extends", () => {
    const t = DEFAULT_PRICING.durationTiers;
    expect(durationFactor(1, t, 0.2)).toBe(1);
    expect(durationFactor(5, t, 0.2)).toBe(2.2);
    expect(durationFactor(10, t, 0.2)).toBe(3.2);
    expect(durationFactor(0, t, 0.2)).toBe(1);
    expect(durationFactor(3, [], 0.2)).toBe(3);
    expect(durationFactor(1, [{ days: 2, factor: 1.5 }], 0.2)).toBe(1.5);
  });

  it("prices lines with days, holidays and discounts", () => {
    expect(priceLine({ kind: "articulo", quantity: 2, unitPrice: 10, priceMode: "dia", discountPct: 10 }, { ...ctx, days: 2 })).toMatchObject({ gross: 30, discount: 3, net: 27 });
    expect(priceLine({ kind: "carpa", quantity: 100, unitPrice: 8, priceMode: "m2", discountPct: 0 }, { ...ctx, days: 5, holiday: true }).net).toBe(1113.6);
    expect(priceLine({ kind: "texto", quantity: 1, unitPrice: 10, priceMode: "unidad", discountPct: 0, unitCost: 3 }, ctx)).toMatchObject({ net: 0, cost: 3 });
    expect(priceLine({ kind: "articulo", quantity: 1, unitPrice: 10, priceMode: "unidad", discountPct: 150 }, ctx).net).toBe(0);
  });

  it("totals with VAT, global discount and margin", () => {
    const t = quoteTotals(
      [
        { kind: "carpa", quantity: 200, unitPrice: 8, priceMode: "m2", discountPct: 0 },
        { kind: "mano_obra", quantity: 10, unitPrice: 30, priceMode: "hora", discountPct: 0, unitCost: 19 },
        { kind: "servicio", quantity: 1, unitPrice: 100, priceMode: "unidad", discountPct: 0, taxRate: 10 },
      ],
      { ...ctx, globalDiscountPct: 10 },
    );
    expect(t.taxable).toBe(1800);
    expect(t.vatBreakdown).toEqual([
      { rate: 21, base: 1710, amount: 359.1 },
      { rate: 10, base: 90, amount: 9 },
    ]);
    expect(t.total).toBe(2168.1);
    expect(t.cost).toBe(190);
    expect(t.marginPct).toBe(89.44);
    expect(quoteTotals([], ctx).marginPct).toBe(0);
  });

  it("tent, transport and labour line builders", () => {
    const lines = tentQuoteLines({
      family: { id: "f", name: "Carpa 10 m", width: 10, moduleLength: 5 },
      modules: 4,
      pricing: { mode: "m2", price: 8 },
      bomLines: [
        { itemId: "a", quantity: 6, group: "lonas", ruleIds: [] },
        { itemId: "b", quantity: 5, group: "estructura", ruleIds: [] },
        { itemId: "c", quantity: 5, group: "estructura", ruleIds: [] },
      ],
      itemPrices: new Map([
        ["a", { name: "Lateral transparente", price: 18, priceMode: "unidad" as const }],
        ["b", { name: "Cercha", price: 0, priceMode: "incluido" as const }],
      ]),
    });
    expect(lines.map((l) => [l.description, l.quantity])).toEqual([
      ["Carpa 10 m 10x20 m", 200],
      ["Lateral transparente", 6],
    ]);
    expect(tentQuoteLines({ family: { id: "f", name: "X", width: 10, moduleLength: 5 }, modules: 2, pricing: { mode: "ml", price: 50 }, bomLines: [], itemPrices: new Map() })[0]!.quantity).toBe(10);
    expect(transportLine(10, 1, DEFAULT_PRICING).unitPrice).toBe(90);
    const tl = transportLine(100, 2, DEFAULT_PRICING);
    expect(tl.unitPrice).toBe(640);
    expect(tl.description).toContain("2 viajes");
    expect(laborLine(12.345, DEFAULT_PRICING).quantity).toBe(12.35);
    const km = haversineKm({ lat: 43.36, lng: -5.85 }, { lat: 43.53, lng: -5.66 });
    expect(km).toBeGreaterThan(20);
    expect(roadKm(10)).toBe(13);
  });
});
