import Link from "next/link";
import { ChartColumn, Download } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { canSeeField } from "@/lib/permissions";
import { formatEUR, formatNumber } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { crewHours, familyOccupancy, marginByProject, revenueByMonth, topClients } from "@/server/analytics";
import { BarChart, HBars, HeatTable } from "./charts";
import { resolveRange } from "./range";

export const metadata = { title: "Analytics" };

function Export({ table, q }: { table: string; q: string }) {
  return (
    <Button asChild size="sm" variant="ghost">
      <a href={`/app/analytics/export?tabla=${table}&${q}`} download>
        <Download /> CSV
      </a>
    </Button>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const range = resolveRange(await searchParams);
  const q = `desde=${range.from}&hasta=${range.to}`;
  const d = await tenantDb(async (tx, ctx) => ({
    occupancy: await familyOccupancy(tx, range),
    revenue: await revenueByMonth(tx, range),
    margin: await marginByProject(tx, range),
    hours: await crewHours(tx, range),
    clients: await topClients(tx, range),
    showMargin: canSeeField(ctx.role, "margen", ctx.fieldPermissions),
  }));
  const totalRevenue = d.revenue.reduce((s, x) => s + x.base, 0);
  const avgOcc = d.occupancy.rows.length ? d.occupancy.rows.flatMap((r) => r.values).reduce((s, v) => s + v, 0) / Math.max(1, d.occupancy.rows.length * d.occupancy.months.length) : 0;
  const planned = d.hours.reduce((s, x) => s + x.planned, 0);
  const worked = d.hours.reduce((s, x) => s + x.worked, 0);
  return (
    <>
      <PageHeader icon={ChartColumn} title="Analytics">
        <form className="flex flex-wrap items-center gap-2" action="/app/analytics">
          <label className="sr-only" htmlFor="an-from">Desde</label>
          <Input id="an-from" type="date" name="desde" defaultValue={range.from} className="h-8 w-auto" />
          <span className="text-muted-foreground">–</span>
          <label className="sr-only" htmlFor="an-to">Hasta</label>
          <Input id="an-to" type="date" name="hasta" defaultValue={range.to} className="h-8 w-auto" />
          <Button size="sm" variant="outline">Aplicar</Button>
        </form>
      </PageHeader>
      <PageBody>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Facturado (base)", formatEUR(totalRevenue)],
            ["Ocupación media de cerchas", `${formatNumber(avgOcc)} %`],
            ["Horas planificadas", `${formatNumber(planned)} h`],
            ["Horas fichadas", `${formatNumber(worked)} h`],
          ].map(([k, v]) => (
            <Card key={k} className="p-4">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="tabular mt-1 text-xl font-semibold">{v}</p>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Ocupación por familia de carpa</CardTitle>
              <CardDescription>Media mensual de cerchas reservadas (confirmadas y opciones) sobre el stock utilizable.</CardDescription>
            </div>
            <Export table="ocupacion" q={q} />
          </CardHeader>
          <CardContent>{d.occupancy.rows.length ? <HeatTable months={d.occupancy.months} rows={d.occupancy.rows} /> : <EmptyState icon={ChartColumn} title="Sin familias de carpa" />}</CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Ingresos por mes</CardTitle>
                <CardDescription><span className="mr-3 inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand-500" /> Facturado (base)</span><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-border-strong" /> Cobrado</span></CardDescription>
              </div>
              <Export table="ingresos" q={q} />
            </CardHeader>
            <CardContent>
              <BarChart label="Ingresos por mes" data={d.revenue.map((r) => ({ key: r.month, value: r.base, secondary: r.cobrado }))} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Clientes principales</CardTitle>
                <CardDescription>Base facturada en el periodo</CardDescription>
              </div>
              <Export table="clientes" q={q} />
            </CardHeader>
            <CardContent>{d.clients.length ? <HBars data={d.clients.map((c) => ({ label: c.name, value: c.base }))} /> : <p className="text-sm text-muted-foreground">Sin facturas en el periodo.</p>}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Rentabilidad por proyecto</CardTitle>
              <CardDescription>Ingreso facturado (o presupuestado si aún no hay factura) frente al coste estimado de material, subalquiler, compras y personal fichado.</CardDescription>
            </div>
            <Export table="margen" q={q} />
          </CardHeader>
          <CardContent>
            {d.margin.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay proyectos en el periodo.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Proyecto</TH>
                    <TH>Cliente</TH>
                    <TH className="text-right">Ingreso</TH>
                    {d.showMargin && <TH className="text-right">Coste</TH>}
                    {d.showMargin && <TH className="text-right">Margen</TH>}
                  </TR>
                </THead>
                <TBody>
                  {d.margin.map((p) => (
                    <TR key={p.id}>
                      <TD><Link href={`/app/proyectos/${p.id}`} className="font-medium hover:underline">{p.name}</Link> <span className="text-xs text-muted-foreground">{p.number}</span></TD>
                      <TD className="text-muted-foreground">{p.client}</TD>
                      <TD className="tabular text-right">{formatEUR(p.revenue)} <span className="block text-[11px] text-muted-foreground">{p.revenueSource}</span></TD>
                      {d.showMargin && <TD className="tabular text-right">{formatEUR(p.cost)}</TD>}
                      {d.showMargin && (
                        <TD className="text-right">
                          <StatusPill tone={p.marginPct >= 40 ? "success" : p.marginPct >= 20 ? "warning" : "danger"}>{formatEUR(p.margin)} · {p.marginPct} %</StatusPill>
                        </TD>
                      )}
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Horas de personal</CardTitle>
              <CardDescription>Planificadas en turnos asignados frente a fichadas</CardDescription>
            </div>
            <Export table="horas" q={q} />
          </CardHeader>
          <CardContent>
            {d.hours.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin turnos ni fichajes en el periodo.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Trabajador</TH>
                    <TH>Tipo</TH>
                    <TH className="text-right">Planificadas</TH>
                    <TH className="text-right">Fichadas</TH>
                    <TH className="text-right">Diferencia</TH>
                  </TR>
                </THead>
                <TBody>
                  {d.hours.map((h) => (
                    <TR key={h.id}>
                      <TD className="font-medium">{h.name}</TD>
                      <TD className="text-muted-foreground">{h.type}</TD>
                      <TD className="tabular text-right">{formatNumber(h.planned)} h</TD>
                      <TD className="tabular text-right">{formatNumber(h.worked)} h</TD>
                      <TD className={`tabular text-right ${h.diff > 0 ? "text-warning" : ""}`}>{h.diff > 0 ? "+" : ""}{formatNumber(h.diff)} h</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
