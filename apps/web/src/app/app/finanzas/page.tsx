import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, LayoutDashboard } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { BalanceChart, BarChart } from "@/components/finance/charts";
import { Kpi } from "@/components/finance/status";
import { canSeeField } from "@/lib/permissions";
import { cn, formatEUR } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { addDaysIso, todayMadrid } from "@/server/finance/calc";
import { refreshOverdue } from "@/server/finance/invoicing";
import { forecast, invoicedInRange, monthlyRevenue, projectMargins, receivablesSummary } from "@/server/finance/queries";

export const metadata: Metadata = { title: "Dashboard financiero" };

const STATUS: Record<string, ["neutral" | "success" | "warning" | "info" | "danger" | "brand", string]> = {
  consulta: ["neutral", "Consulta"],
  opcion: ["warning", "Opción"],
  confirmado: ["success", "Confirmado"],
  en_curso: ["info", "En curso"],
  devuelto: ["neutral", "Devuelto"],
};

export default async function FinanceDashboard() {
  const today = todayMadrid();
  const monthStart = `${today.slice(0, 7)}-01`;
  const prevMonthStart = addDaysIso(monthStart, -1).slice(0, 7) + "-01";
  const prevMonthSameDay = (() => {
    const d = addDaysIso(prevMonthStart, Number(today.slice(8)) - 1);
    return d.slice(0, 7) === prevMonthStart.slice(0, 7) ? d : addDaysIso(monthStart, -1);
  })();
  const data = await tenantDb(async (tx, ctx) => {
    await refreshOverdue(tx);
    const [thisMonth, prevMonth, prevMonthToDate, recv, months, fc, margins] = await Promise.all([
      invoicedInRange(tx, monthStart, today),
      invoicedInRange(tx, prevMonthStart, addDaysIso(monthStart, -1)),
      invoicedInRange(tx, prevMonthStart, prevMonthSameDay),
      receivablesSummary(tx),
      monthlyRevenue(tx, 12),
      forecast(tx, 30),
      projectMargins(tx, 20),
    ]);
    return { thisMonth, prevMonth, prevMonthToDate, recv, months, fc, margins, showMargin: canSeeField(ctx.role, "margen", ctx.fieldPermissions) };
  }, "finanzas");

  const delta = data.prevMonthToDate.base > 0 ? ((data.thisMonth.base - data.prevMonthToDate.base) / data.prevMonthToDate.base) * 100 : null;
  const cash30 = data.fc.series[data.fc.series.length - 1]?.balance ?? data.fc.opening;
  const yearTotal = data.months.filter((m) => m.month.startsWith(today.slice(0, 4))).reduce((s, m) => s + m.base, 0);
  const totals = data.margins.reduce((a, m) => ({ revenue: a.revenue + m.revenue, cost: a.cost + m.cost }), { revenue: 0, cost: 0 });

  return (
    <>
      <PageHeader icon={LayoutDashboard} title="Dashboard" subtitle="Facturación, cobros, previsión y margen">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/ventas">Ver ventas</Link>
        </Button>
      </PageHeader>
      <PageBody>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Facturado este mes"
            value={formatEUR(data.thisMonth.base)}
            hint={
              delta === null ? (
                `${data.thisMonth.count} facturas · mes anterior ${formatEUR(data.prevMonth.base)}`
              ) : (
                <span className="inline-flex flex-wrap items-center gap-1">
                  {delta >= 0 ? <ArrowUpRight className="size-3 text-success" /> : <ArrowDownRight className="size-3 text-danger" />}
                  <span className={cn("whitespace-nowrap", delta >= 0 ? "text-success" : "text-danger")}>{Math.abs(Math.round(delta))} %</span> vs. mismo periodo del mes anterior
                </span>
              )
            }
          />
          <Kpi label="Cobros pendientes" value={formatEUR(data.recv.pending)} hint={<Link className="hover:underline" href="/app/ventas?estado=emitida">Facturas emitidas sin cobrar</Link>} />
          <Kpi label="Vencido" value={formatEUR(data.recv.overdue)} tone={data.recv.overdue > 0 ? "danger" : undefined} hint={<Link className="hover:underline" href="/app/ventas?estado=vencida">{data.recv.overdueCount} factura{data.recv.overdueCount === 1 ? "" : "s"} vencida{data.recv.overdueCount === 1 ? "" : "s"}</Link>} />
          <Kpi label="Caja prevista a 30 días" value={formatEUR(cash30)} tone={cash30 < 0 ? "danger" : undefined} hint={`Hoy ${formatEUR(data.fc.opening)}`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Facturación mensual</CardTitle>
                <CardDescription>Base imponible de facturas emitidas · {formatEUR(yearTotal)} en {today.slice(0, 4)}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <BarChart data={data.months.map((m) => ({ label: m.label, value: m.base }))} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Previsión de caja</CardTitle>
                <CardDescription>Próximos 30 días</CardDescription>
              </div>
              <Link href="/app/tesoreria" className="text-sm text-link hover:underline">
                Tesorería
              </Link>
            </CardHeader>
            <CardContent>
              <BalanceChart points={data.fc.series} height={260} width={420} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Margen por proyecto</CardTitle>
              <CardDescription>Ingreso facturado (o presupuesto aceptado si aún no se ha facturado) frente al coste estimado de líneas, subalquileres, compras imputadas y horas fichadas.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {data.margins.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState icon={LayoutDashboard} title="Sin proyectos" description="Cuando tengas proyectos con presupuesto verás aquí su rentabilidad." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y bg-subtle text-[13px] text-muted-foreground">
                    <tr>
                      <th className="px-5 py-2.5 text-left font-normal">Proyecto</th>
                      <th className="px-3 py-2.5 text-left font-normal">Estado</th>
                      <th className="px-3 py-2.5 text-right font-normal">Ingreso</th>
                      {data.showMargin && (
                        <>
                          <th className="px-3 py-2.5 text-right font-normal">Material y servicios</th>
                          <th className="px-3 py-2.5 text-right font-normal">Subalquiler</th>
                          <th className="px-3 py-2.5 text-right font-normal">Compras</th>
                          <th className="px-3 py-2.5 text-right font-normal">Personal</th>
                          <th className="px-3 py-2.5 text-right font-normal">Margen</th>
                          <th className="px-5 py-2.5 text-right font-normal">%</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.margins.map((m) => {
                      const [tone, label] = STATUS[m.status] ?? ["neutral", m.status];
                      return (
                        <tr key={m.id} className="border-b last:border-0 hover:bg-subtle">
                          <td className="px-5 py-2.5">
                            <Link href={`/app/proyectos/${m.id}`} className="font-medium hover:underline">
                              {m.name}
                            </Link>
                            <span className="ml-2 whitespace-nowrap text-xs text-muted-foreground">{m.number}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusPill tone={tone}>{label}</StatusPill>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular">
                            {formatEUR(m.revenue)}
                            {m.revenueSource === "presupuesto" && m.revenue > 0 && <span className="ml-1 text-[11px] text-muted-foreground">pres.</span>}
                          </td>
                          {data.showMargin && (
                            <>
                              <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{formatEUR(m.linesCost)}</td>
                              <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{formatEUR(m.subrentalCost)}</td>
                              <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{formatEUR(m.purchasesCost)}</td>
                              <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{formatEUR(m.crewCost)}</td>
                              <td className={cn("px-3 py-2.5 text-right tabular font-medium", m.margin < 0 && "text-danger")}>{formatEUR(m.margin)}</td>
                              <td className={cn("whitespace-nowrap px-5 py-2.5 text-right tabular", m.marginPct < 20 && m.revenue > 0 ? "text-warning" : "")}>{m.revenue > 0 ? `${Math.round(m.marginPct)} %` : "—"}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  {data.showMargin && (
                    <tfoot>
                      <tr className="border-t bg-subtle font-medium">
                        <td className="px-5 py-2.5" colSpan={2}>
                          Total
                        </td>
                        <td className="px-3 py-2.5 text-right tabular">{formatEUR(totals.revenue)}</td>
                        <td colSpan={4} className="px-3 py-2.5 text-right tabular text-muted-foreground">
                          Coste {formatEUR(totals.cost)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular">{formatEUR(totals.revenue - totals.cost)}</td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-right tabular">{totals.revenue > 0 ? `${Math.round(((totals.revenue - totals.cost) / totals.revenue) * 100)} %` : "—"}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        {!data.showMargin && <p className="text-xs text-muted-foreground">Los costes y márgenes solo son visibles para los roles autorizados.</p>}
      </PageBody>
    </>
  );
}
