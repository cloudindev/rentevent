import { NextResponse } from "next/server";
import { withTenant } from "@rentevent/db";
import { can } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { toCsv, todayMadrid } from "@/server/finance/calc";
import { parseLines } from "@/server/finance/invoicing";
import { invoiceTotals } from "@/server/finance/calc";
import { salesBook } from "@/server/finance/queries";
import type { ClientSnapshot } from "@/server/finance/invoicing";

/** Libro registro de facturas expedidas (CSV, separador ;). */
export async function GET(req: Request) {
  const ctx = await getAppContext();
  if (!ctx || !can(ctx.role, "finanzas")) return new NextResponse("No autorizado", { status: 403 });
  const url = new URL(req.url);
  const valid = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const today = todayMadrid();
  const from = valid(url.searchParams.get("desde")) ?? `${today.slice(0, 4)}-01-01`;
  const to = valid(url.searchParams.get("hasta")) ?? today;
  const rows = await withTenant(ctx.tenantId, (tx) => salesBook(tx, from, to));
  const out: (string | number | null)[][] = [["Fecha", "Número", "Tipo", "NIF", "Cliente", "Tipo IVA", "Base imponible", "Cuota IVA", "Total", "Rectifica", "Huella"]];
  for (const r of rows) {
    const t = invoiceTotals(parseLines(r.inv.lines));
    const snap = r.inv.clientSnapshot as ClientSnapshot | null;
    for (const b of t.breakdown.length ? t.breakdown : [{ rate: 21, base: 0, amount: 0 }]) {
      out.push([r.inv.issueDate, r.inv.fullNumber, r.inv.kind, snap?.taxId ?? r.clientTaxId, snap?.legalName ?? snap?.name ?? r.clientName, `${b.rate} %`, b.base, b.amount, b.base + b.amount, r.inv.rectifiesId ? "sí" : "", r.inv.recordHash]);
    }
  }
  return new NextResponse(toCsv(out), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="facturas-emitidas-${from}-${to}.csv"` },
  });
}
