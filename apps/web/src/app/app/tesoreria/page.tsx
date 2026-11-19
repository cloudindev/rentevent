import type { Metadata } from "next";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BalanceChart } from "@/components/finance/charts";
import { Kpi } from "@/components/finance/status";
import { MovementButtons, MovementRowActions, NewAccountDialog } from "@/components/finance/treasury";
import { cn, formatDate, formatEUR } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { accountMovements, accountsWithBalance, forecast, reconciliationCandidates } from "@/server/finance/queries";

export const metadata: Metadata = { title: "Tesorería" };

export default async function TreasuryPage({ searchParams }: { searchParams: Promise<{ cuenta?: string; ver?: string }> }) {
  const sp = await searchParams;
  const data = await tenantDb(async (tx) => {
    const accounts = await accountsWithBalance(tx);
    const selected = accounts.find((a) => a.id === sp.cuenta) ?? accounts[0] ?? null;
    const [mov, fc, candidates] = await Promise.all([selected ? accountMovements(tx, selected.id) : null, forecast(tx, 90), reconciliationCandidates(tx)]);
    return { accounts, selected, mov, fc, candidates };
  }, "finanzas");
  const total = data.accounts.reduce((s, a) => s + a.balance, 0);
  const min = data.fc.series.reduce((m, p) => (p.balance < m.balance ? p : m), data.fc.series[0] ?? { date: "", balance: 0, in: 0, out: 0 });
  const in30 = data.fc.series[29]?.balance ?? total;
  const filter = sp.ver === "pendientes" ? "pendientes" : "todos";
  const movements = (data.mov?.movements ?? []).filter((r) => filter === "todos" || (!r.m.reconciled && !r.m.forecast));

  return (
    <>
      <PageHeader icon={Landmark} title="Tesorería" subtitle="Cuentas, conciliación y previsión de caja">
        <NewAccountDialog />
        {data.selected && <MovementButtons accountId={data.selected.id} />}
      </PageHeader>
      <PageBody>
        <div className="grid gap-3 sm:grid-cols-4">
          <Kpi label="Saldo total" value={formatEUR(total)} hint={`${data.accounts.length} cuenta${data.accounts.length === 1 ? "" : "s"}`} />
          <Kpi label="Cobros previstos" value={formatEUR(data.fc.receivables)} hint="Facturas emitidas pendientes" />
          <Kpi label="Pagos previstos" value={formatEUR(data.fc.payables)} hint="Compras pendientes" />
          <Kpi label="Saldo a 30 días" value={formatEUR(in30)} tone={in30 < 0 ? "danger" : undefined} />
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Previsión de caja · 90 días</CardTitle>
              <CardDescription>Saldo actual + cobros por vencimiento (los vencidos, en 7 días) − pagos pendientes ± movimientos previstos.</CardDescription>
            </div>
            {min && (
              <StatusPill tone={min.balance < 0 ? "danger" : "neutral"}>
                Mínimo {formatEUR(min.balance)} · {min.date ? formatDate(min.date) : "—"}
              </StatusPill>
            )}
          </CardHeader>
          <CardContent>
            <BalanceChart points={data.fc.series} />
          </CardContent>
        </Card>

        {data.accounts.length === 0 ? (
          <EmptyState icon={Landmark} title="Sin cuentas" description="Crea tu cuenta bancaria para conciliar cobros y pagos." />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {data.accounts.map((a) => (
                <Link
                  key={a.id}
                  href={`/app/tesoreria?cuenta=${a.id}`}
                  className={cn("rounded-xl border px-4 py-2.5 text-sm hover:bg-subtle", data.selected?.id === a.id && "border-foreground/40 bg-accent")}
                >
                  <span className="block font-medium">{a.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatEUR(a.balance)} · {a.pending} sin conciliar
                  </span>
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Link href={`/app/tesoreria?cuenta=${data.selected?.id}`} className={cn("rounded-full px-3 py-1", filter === "todos" ? "bg-accent font-medium" : "text-muted-foreground")}>
                Todos
              </Link>
              <Link href={`/app/tesoreria?cuenta=${data.selected?.id}&ver=pendientes`} className={cn("rounded-full px-3 py-1", filter === "pendientes" ? "bg-accent font-medium" : "text-muted-foreground")}>
                Sin conciliar
              </Link>
            </div>
            {movements.length === 0 ? (
              <EmptyState icon={Landmark} title={filter === "pendientes" ? "Todo conciliado" : "Sin movimientos"} description="Importa el extracto del banco o añade movimientos a mano." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Fecha</TH>
                    <TH>Concepto</TH>
                    <TH>Vinculado a</TH>
                    <TH className="text-right">Importe</TH>
                    <TH className="text-right">Saldo</TH>
                    <TH>Estado</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {movements.map((r) => (
                    <TR key={r.m.id} className={cn(r.m.forecast && "text-muted-foreground")}>
                      <TD className="whitespace-nowrap tabular">{formatDate(r.m.bookedOn)}</TD>
                      <TD className="max-w-80">
                        <span className="line-clamp-1">{r.m.concept}</span>
                        {r.m.category && <span className="text-xs text-muted-foreground">{r.m.category}</span>}
                      </TD>
                      <TD className="text-sm">
                        {r.m.invoiceId ? (
                          <Link className="text-link hover:underline" href={`/app/ventas/${r.m.invoiceId}`}>
                            {r.invoiceNumber}
                          </Link>
                        ) : r.purchaseConcept ? (
                          <Link className="text-link hover:underline" href="/app/compras">
                            {r.purchaseConcept}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TD>
                      <TD className={cn("text-right tabular font-medium", Number(r.m.amount) > 0 && "text-success")}>{formatEUR(Number(r.m.amount))}</TD>
                      <TD className="text-right tabular">{r.m.forecast ? "—" : formatEUR(r.balance)}</TD>
                      <TD>
                        {r.m.forecast ? <StatusPill tone="info">Previsto</StatusPill> : r.m.reconciled ? <StatusPill tone="success">Conciliado</StatusPill> : <StatusPill tone="warning">Pendiente</StatusPill>}
                      </TD>
                      <TD>
                        <MovementRowActions
                          movement={{ id: r.m.id, amount: Number(r.m.amount), concept: r.m.concept, reconciled: r.m.reconciled, invoiceId: r.m.invoiceId, forecast: r.m.forecast }}
                          candidates={{ invoices: data.candidates.invoices, purchases: data.candidates.purchases.map((p) => ({ ...p, total: Number(p.total) })) }}
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
