/**
 * Pure finance helpers, safe for client bundles (no Node APIs) and unit-testable.
 */
import { DEFAULT_PRICING, dayKey, quoteTotals, type QuoteTotals } from "@rentevent/core";

export type InvoiceLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  taxRate: number;
};

export type InvoiceTotals = { subtotal: number; vat: number; total: number; breakdown: QuoteTotals["vatBreakdown"] };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function lineNet(l: InvoiceLine): number {
  const gross = r2(l.quantity * l.unitPrice);
  return r2(gross - r2((gross * Math.min(100, Math.max(0, l.discountPct ?? 0))) / 100));
}

/** Totals of an invoice from its lines, grouped by VAT rate. */
export function invoiceTotals(lines: InvoiceLine[]): InvoiceTotals {
  const t = quoteTotals(
    lines.map((l) => ({ kind: "articulo" as const, quantity: l.quantity, unitPrice: l.unitPrice, priceMode: "unidad" as const, discountPct: l.discountPct ?? 0, taxRate: l.taxRate })),
    { days: 1, holiday: false, settings: DEFAULT_PRICING },
  );
  return { subtotal: t.taxable, vat: t.vat, total: t.total, breakdown: t.vatBreakdown.filter((b) => b.base !== 0 || b.amount !== 0) };
}

export type AdvanceInvoice = { fullNumber: string; lines: InvoiceLine[] };

/** Negative lines deducting previously issued advance invoices (one per advance and VAT rate). */
export function advanceDeductionLines(advances: AdvanceInvoice[]): InvoiceLine[] {
  const out: InvoiceLine[] = [];
  for (const a of advances) {
    const byRate = new Map<number, number>();
    for (const l of a.lines) byRate.set(l.taxRate, r2((byRate.get(l.taxRate) ?? 0) + lineNet(l)));
    for (const [rate, base] of byRate) {
      if (base === 0) continue;
      out.push({ description: `Deducción anticipo ${a.fullNumber}`, quantity: 1, unitPrice: -base, taxRate: rate });
    }
  }
  return out;
}

/** Advance invoice lines: `percent` of the taxable base, one line per VAT rate. */
export function advanceLines(breakdown: { rate: number; base: number }[], percent: number, label: string): InvoiceLine[] {
  const p = Math.min(100, Math.max(0, percent)) / 100;
  return breakdown
    .filter((b) => b.base !== 0)
    .map((b) => ({ description: `${label} (${Math.round(p * 100)} %)${breakdown.length > 1 ? ` · IVA ${b.rate} %` : ""}`, quantity: 1, unitPrice: r2(b.base * p), taxRate: b.rate }));
}

export function negateLines(lines: InvoiceLine[]): InvoiceLine[] {
  return lines.map((l) => ({ ...l, quantity: -Math.abs(l.quantity) * Math.sign(l.quantity || 1) }));
}

/** dd-mm-yyyy as used in Verifactu records. */
export function verifactuDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y}`;
}

export const todayMadrid = (now = Date.now()) => dayKey(now);

export function addDaysIso(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

export function isOverdue(inv: { status: string; dueDate: string | null; total: number; paid: number }, today: string) {
  return (inv.status === "emitida" || inv.status === "vencida") && inv.dueDate != null && inv.dueDate < today && inv.paid < inv.total - 0.005;
}

export function formatFullNumber(code: string, year: number, n: number) {
  return `${code}${year}-${String(n).padStart(4, "0")}`;
}

/** CSV with ; separator and Spanish decimal comma (Excel-friendly). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    if (v == null) return "";
    const s = typeof v === "number" ? v.toFixed(2).replace(".", ",") : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}

/** Parses bank statement CSV: date;concept;amount (dd/mm/yyyy or yyyy-mm-dd, comma or dot decimals). */
export function parseBankCsv(text: string): { rows: { date: string; concept: string; amount: number }[]; errors: string[] } {
  const rows: { date: string; concept: string; amount: number }[] = [];
  const errors: string[] = [];
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  lines.forEach((line, i) => {
    const parts = line.split(/[;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 3) {
      errors.push(`Línea ${i + 1}: faltan columnas`);
      return;
    }
    const [rawDate, concept, rawAmount] = [parts[0]!, parts.slice(1, -1).join(" "), parts[parts.length - 1]!];
    let date: string | null = null;
    const dmy = rawDate.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    const ymd = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dmy) date = `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
    else if (ymd) date = rawDate;
    const normalized = rawAmount.includes(",") ? rawAmount.replace(/\./g, "").replace(",", ".") : rawAmount;
    const cleaned = normalized.replace(/[^\d.-]/g, "");
    const amount = /\d/.test(cleaned) ? Number(cleaned) : Number.NaN;
    if (!date) {
      if (i === 0) return; // header
      errors.push(`Línea ${i + 1}: fecha no válida`);
      return;
    }
    if (!Number.isFinite(amount)) {
      errors.push(`Línea ${i + 1}: importe no válido`);
      return;
    }
    rows.push({ date, concept: concept || "Movimiento", amount: r2(amount) });
  });
  return { rows, errors };
}

export type CashEvent = { date: string; amount: number };

/** Daily running balance from `start` for `days` days. */
export function cashForecast(opening: number, events: CashEvent[], start: string, days: number): { date: string; balance: number; in: number; out: number }[] {
  const out: { date: string; balance: number; in: number; out: number }[] = [];
  let bal = opening;
  for (const e of events) if (e.date < start) bal += e.amount;
  for (let i = 0; i < days; i++) {
    const d = addDaysIso(start, i);
    const today = events.filter((e) => e.date === d);
    const inc = today.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const exp = today.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);
    bal = r2(bal + inc + exp);
    out.push({ date: d, balance: bal, in: r2(inc), out: r2(exp) });
  }
  return out;
}
