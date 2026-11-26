import { withTenant } from "@rentevent/db";
import { can, canSeeField } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { WORKER_TYPE_LABELS } from "@/components/crew/bits";
import { crewHours, familyOccupancy, marginByProject, revenueByMonth, toCsv, topClients } from "@/server/analytics";
import { resolveRange } from "../range";

export async function GET(req: Request) {
  const ctx = await getAppContext();
  if (!ctx || !can(ctx.role, "ver")) return new Response("No autorizado", { status: 401 });
  const url = new URL(req.url);
  const range = resolveRange({ desde: url.searchParams.get("desde") ?? undefined, hasta: url.searchParams.get("hasta") ?? undefined });
  const table = url.searchParams.get("tabla") ?? "";
  const showFinance = can(ctx.role, "finanzas");
  const showMargin = canSeeField(ctx.role, "margen", ctx.fieldPermissions);
  // same rules as the page: billing needs Finanzas, profitability needs Finanzas or the margin field
  if ((table === "ingresos" || table === "clientes") && !showFinance) return new Response("No autorizado", { status: 403 });
  if (table === "margen" && !showFinance && !showMargin) return new Response("No autorizado", { status: 403 });
  const csv = await withTenant(ctx.tenantId, async (tx) => {
    switch (table) {
      case "ocupacion": {
        const o = await familyOccupancy(tx, range);
        return toCsv(["Familia", "Cercha", ...o.months], o.rows.map((r) => [r.family, r.truss, ...r.values]));
      }
      case "ingresos":
        return toCsv(["Mes", "Base facturada", "Cobrado", "Facturas"], (await revenueByMonth(tx, range)).map((r) => [r.month, r.base, r.cobrado, r.facturas]));
      case "clientes":
        return toCsv(["Cliente", "Base facturada", "Facturas"], (await topClients(tx, range, 100)).map((r) => [r.name, r.base, r.invoices]));
      case "margen":
        return toCsv(
          showMargin ? ["Proyecto", "Número", "Cliente", "Ingreso", "Origen", "Coste", "Margen", "Margen %"] : ["Proyecto", "Número", "Cliente", "Ingreso", "Origen"],
          (await marginByProject(tx, range)).map((p) => (showMargin ? [p.name, p.number, p.client, p.revenue, p.revenueSource, p.cost, p.margin, p.marginPct] : [p.name, p.number, p.client, p.revenue, p.revenueSource])),
        );
      case "horas":
        return toCsv(["Trabajador", "Tipo", "Planificadas", "Fichadas", "Diferencia"], (await crewHours(tx, range)).map((h) => [h.name, WORKER_TYPE_LABELS[h.type] ?? h.type, h.planned, h.worked, h.diff]));
      default:
        return null;
    }
  });
  if (csv === null) return new Response("Tabla desconocida", { status: 400 });
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="analytics-${table}-${range.from}-${range.to}.csv"` } });
}
