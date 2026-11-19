import { NextResponse } from "next/server";
import { withTenant } from "@rentevent/db";
import { can } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { toCsv, todayMadrid } from "@/server/finance/calc";
import { purchasesBook } from "@/server/finance/queries";

/** Libro registro de facturas recibidas (CSV, separador ;). */
export async function GET(req: Request) {
  const ctx = await getAppContext();
  if (!ctx || !can(ctx.role, "finanzas")) return new NextResponse("No autorizado", { status: 403 });
  const url = new URL(req.url);
  const valid = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const today = todayMadrid();
  const from = valid(url.searchParams.get("desde")) ?? `${today.slice(0, 4)}-01-01`;
  const to = valid(url.searchParams.get("hasta")) ?? today;
  const rows = await withTenant(ctx.tenantId, (tx) => purchasesBook(tx, from, to));
  const out: (string | number | null)[][] = [["Fecha", "Número", "NIF proveedor", "Proveedor", "Concepto", "Categoría", "Base imponible", "Cuota IVA", "Total", "Estado", "Fecha de pago"]];
  for (const r of rows) out.push([r.p.issueDate, r.p.number, r.supplierTaxId, r.supplierName, r.p.concept, r.p.category, Number(r.p.base), Number(r.p.vat), Number(r.p.total), r.p.status, r.p.paidOn]);
  return new NextResponse(toCsv(out), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="facturas-recibidas-${from}-${to}.csv"` },
  });
}
