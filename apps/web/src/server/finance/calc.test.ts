import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  advanceDeductionLines,
  advanceLines,
  cashForecast,
  formatFullNumber,
  invoiceTotals,
  isOverdue,
  lineNet,
  negateLines,
  parseBankCsv,
  toCsv,
  verifactuDate,
} from "./calc";
import { verifactuHash, verifyChain } from "./hash";

describe("invoice totals", () => {
  it("sums lines with discounts and groups VAT", () => {
    const t = invoiceTotals([
      { description: "Carpa", quantity: 200, unitPrice: 8, taxRate: 21 },
      { description: "Sillas", quantity: 100, unitPrice: 1.2, discountPct: 10, taxRate: 21 },
      { description: "Servicio", quantity: 1, unitPrice: 100, taxRate: 10 },
    ]);
    expect(t.subtotal).toBe(1808);
    expect(t.breakdown).toEqual([
      { rate: 21, base: 1708, amount: 358.68 },
      { rate: 10, base: 100, amount: 10 },
    ]);
    expect(t.total).toBe(2176.68);
    expect(lineNet({ description: "", quantity: 3, unitPrice: 9.99, discountPct: 0, taxRate: 21 })).toBe(29.97);
  });

  it("advance invoice and its deduction on the final invoice cancel out", () => {
    const order = invoiceTotals([
      { description: "Carpa", quantity: 1, unitPrice: 5000, taxRate: 21 },
      { description: "Servicio", quantity: 1, unitPrice: 200, taxRate: 10 },
    ]);
    const adv = advanceLines(order.breakdown, 30, "Anticipo pedido 262041");
    expect(adv.map((l) => l.unitPrice)).toEqual([1500, 60]);
    expect(invoiceTotals(adv).total).toBe(1815 + 66);
    const deduction = advanceDeductionLines([{ fullNumber: "A2026-0001", lines: adv }]);
    expect(deduction.map((l) => [l.unitPrice, l.taxRate])).toEqual([
      [-1500, 21],
      [-60, 10],
    ]);
    const final = invoiceTotals([{ description: "Carpa", quantity: 1, unitPrice: 5000, taxRate: 21 }, { description: "Servicio", quantity: 1, unitPrice: 200, taxRate: 10 }, ...deduction]);
    expect(final.total).toBe(order.total - invoiceTotals(adv).total);
    expect(advanceDeductionLines([{ fullNumber: "A", lines: [{ description: "", quantity: 0, unitPrice: 1, taxRate: 21 }] }])).toEqual([]);
    expect(advanceLines([{ rate: 21, base: 100 }], 150, "x")[0]!.unitPrice).toBe(100);
  });

  it("rectifications negate quantities", () => {
    expect(negateLines([{ description: "a", quantity: 2, unitPrice: 10, taxRate: 21 }])[0]!.quantity).toBe(-2);
    expect(invoiceTotals(negateLines([{ description: "a", quantity: 2, unitPrice: 10, taxRate: 21 }])).total).toBe(-24.2);
  });
});

describe("verifactu chain", () => {
  const first = { taxId: "b33000000", fullNumber: "F2026-0001", issueDate: "2026-11-19", total: 1210, previousHash: null };
  it("is deterministic, uppercase SHA-256 and depends on every field", () => {
    const h = verifactuHash(first);
    expect(h).toMatch(/^[0-9A-F]{64}$/);
    expect(verifactuHash(first)).toBe(h);
    expect(verifactuHash({ ...first, total: 1210.01 })).not.toBe(h);
    expect(verifactuHash({ ...first, previousHash: "X" })).not.toBe(h);
    expect(verifactuDate("2026-11-19")).toBe("19-11-2026");
  });
  it("detects tampering in the chain", () => {
    const h1 = verifactuHash(first);
    const second = { taxId: "B33000000", fullNumber: "F2026-0002", issueDate: "2026-11-20", total: 500, previousHash: h1 };
    const h2 = verifactuHash(second);
    const chain = [
      { ...first, recordHash: h1 },
      { ...second, recordHash: h2 },
    ];
    expect(verifyChain(chain)).toEqual({ ok: true, brokenAt: null });
    expect(verifyChain([{ ...chain[0]!, total: 1 }, chain[1]!])).toEqual({ ok: false, brokenAt: "F2026-0001" });
    expect(verifyChain([chain[0]!, { ...chain[1]!, previousHash: "nope" }])).toEqual({ ok: false, brokenAt: "F2026-0002" });
  });
});

describe("misc helpers", () => {
  it("overdue detection", () => {
    expect(isOverdue({ status: "emitida", dueDate: "2026-11-01", total: 100, paid: 0 }, "2026-11-19")).toBe(true);
    expect(isOverdue({ status: "emitida", dueDate: "2026-11-01", total: 100, paid: 100 }, "2026-11-19")).toBe(false);
    expect(isOverdue({ status: "borrador", dueDate: "2026-11-01", total: 100, paid: 0 }, "2026-11-19")).toBe(false);
    expect(isOverdue({ status: "emitida", dueDate: "2026-12-01", total: 100, paid: 0 }, "2026-11-19")).toBe(false);
  });
  it("numbers, dates and csv", () => {
    expect(formatFullNumber("F", 2026, 16)).toBe("F2026-0016");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(toCsv([["a;b", 1.5, null], ['x"y', "z", 2]])).toBe('﻿"a;b";1,50;\r\n"x""y";z;2,00');
  });
  it("parses bank CSV in Spanish and ISO formats", () => {
    const r = parseBankCsv("Fecha;Concepto;Importe\n19/11/2026;Cobro F2026-0001;1.210,00\n2026-11-20;Gasóleo;-85.5\nmal;x;1\n2026-11-21;sin importe;abc\nsolo;dos");
    expect(r.rows).toEqual([
      { date: "2026-11-19", concept: "Cobro F2026-0001", amount: 1210 },
      { date: "2026-11-20", concept: "Gasóleo", amount: -85.5 },
    ]);
    expect(r.errors).toHaveLength(3);
  });
  it("cash forecast", () => {
    const f = cashForecast(1000, [{ date: "2026-11-01", amount: 50 }, { date: "2026-11-20", amount: 200 }, { date: "2026-11-21", amount: -500 }], "2026-11-20", 3);
    expect(f.map((x) => x.balance)).toEqual([1250, 750, 750]);
    expect(f[1]).toMatchObject({ in: 0, out: -500 });
  });
});
