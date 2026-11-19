import type { Metadata } from "next";
import Link from "next/link";
import { Download, Receipt } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FilterBar } from "@/components/finance/filter-bar";
import { NewInvoiceDialog, NewSeriesDialog } from "@/components/finance/new-invoice-dialog";
import { InvoiceStatus, Kpi } from "@/components/finance/status";
import { cn, formatDate, formatEUR } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { INVOICE_KIND_LABELS, refreshOverdue } from "@/server/finance/invoicing";
import { clientOptions, invoiceableOrders, listInvoices, listSeries, receivablesSummary } from "@/server/finance/queries";

export const metadata: Metadata = { title: "Ventas" };

type SP = { vista?: string; estado?: string; serie?: string; desde?: string; hasta?: string; q?: string; pedido?: string };

const TABS = [
  { key: "facturas", label: "Facturas" },
  { key: "anticipos", label: "Anticipos" },
  { key: "rectificativas", label: "Rectificativas" },
  { key: "series", label: "Series" },
];

export default async function SalesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const vista = TABS.some((t) => t.key === sp.vista) ? sp.vista! : "facturas";
  const data = await tenantDb(async (tx) => {
    await refreshOverdue(tx);
    const tipo = vista === "anticipos" ? "anticipo" : vista === "rectificativas" ? "rectificativa" : vista === "facturas" ? "normal" : undefined;
    const [rows, series, orders, clients, summary] = await Promise.all([
      vista === "series" ? Promise.resolve([]) : listInvoices(tx, { ...sp, tipo }),
      listSeries(tx),
      invoiceableOrders(tx),
      clientOptions(tx),
      receivablesSummary(tx),
    ]);
    return { rows, series, orders, clients, summary };
  }, "finanzas");

  const totals = data.rows.reduce((a, r) => ({ base: a.base + Number(r.subtotal), total: a.total + Number(r.total), pend: a.pend + (r.fullNumber && r.status !== "anulada" ? Number(r.total) - Number(r.paid) : 0) }), { base: 0, total: 0, pend: 0 });
  const year = new Date().getFullYear();
  const exportHref = `/app/ventas/export?desde=${sp.desde ?? `${year}-01-01`}&hasta=${sp.hasta ?? `${year}-12-31`}`;

  return (
    <>
      <PageHeader icon={Receipt} title="Ventas" subtitle="Facturas, anticipos, rectificativas y cobros">
        <Button asChild variant="outline" size="sm">
          <a href={exportHref}>
            <Download /> Libro de emitidas
          </a>
        </Button>
        {vista === "series" ? <NewSeriesDialog /> : <NewInvoiceDialog orders={data.orders} clients={data.clients} defaultOrderId={sp.pedido} />}
      </PageHeader>
      <PageBody>
        <div className="grid gap-3 sm:grid-cols-4">
          <Kpi label="Pendiente de cobro" value={formatEUR(data.summary.pending)} />
          <Kpi label="Vencido" value={formatEUR(data.summary.overdue)} tone={data.summary.overdue > 0 ? "danger" : undefined} hint={`${data.summary.overdueCount} factura${data.summary.overdueCount === 1 ? "" : "s"}`} />
          <Kpi label="Borradores" value={String(data.summary.drafts)} hint="Sin número asignado" />
          <Kpi label="Base en la vista" value={formatEUR(totals.base)} hint={`${data.rows.length} documentos`} />
        </div>

        <nav className="flex gap-1 border-b" aria-label="Vistas de ventas">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/app/ventas?vista=${t.key}`}
              aria-current={vista === t.key ? "page" : undefined}
              className={cn("-mb-px border-b-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground", vista === t.key ? "border-foreground font-medium text-foreground" : "border-transparent")}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {vista === "series" ? (
          data.series.length === 0 ? (
            <EmptyState icon={Receipt} title="Sin series" description="Las series se crean automáticamente al emitir la primera factura del año." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Código</TH>
                  <TH>Nombre</TH>
                  <TH>Tipo</TH>
                  <TH>Año</TH>
                  <TH className="text-right">Siguiente número</TH>
                </TR>
              </THead>
              <TBody>
                {data.series.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">{s.code}</TD>
                    <TD>{s.name}</TD>
                    <TD>{INVOICE_KIND_LABELS[s.kind] ?? s.kind}</TD>
                    <TD className="tabular">{s.year}</TD>
                    <TD className="text-right tabular">
                      {s.code}
                      {s.year}-{String(s.nextNumber).padStart(4, "0")}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )
        ) : (
          <>
            <FilterBar
              resetHref={`/app/ventas?vista=${vista}`}
              hidden={{ vista }}
              values={sp}
              fields={[
                { type: "search", name: "q", placeholder: "Número, cliente o NIF" },
                {
                  type: "select",
                  name: "estado",
                  label: "Estado",
                  options: [
                    { value: "borrador", label: "Borrador" },
                    { value: "emitida", label: "Emitida" },
                    { value: "vencida", label: "Vencida" },
                    { value: "cobrada", label: "Cobrada" },
                    { value: "anulada", label: "Anulada" },
                  ],
                },
                { type: "select", name: "serie", label: "Serie", options: data.series.map((s) => ({ value: s.id, label: `${s.code} ${s.year}` })) },
                { type: "date", name: "desde", label: "Desde" },
                { type: "date", name: "hasta", label: "Hasta" },
              ]}
            />
            {data.rows.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={vista === "anticipos" ? "Sin anticipos" : vista === "rectificativas" ? "Sin rectificativas" : "Sin facturas"}
                description={vista === "facturas" ? "Crea una factura desde un pedido confirmado o en blanco." : "Cambia los filtros o crea una desde un pedido."}
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Número</TH>
                    <TH>Fecha</TH>
                    <TH>Cliente</TH>
                    <TH>Pedido</TH>
                    <TH>Vencimiento</TH>
                    <TH className="text-right">Base</TH>
                    <TH className="text-right">Total</TH>
                    <TH className="text-right">Pendiente</TH>
                    <TH>Estado</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.rows.map((r) => {
                    const pending = r.fullNumber && r.status !== "anulada" ? Number(r.total) - Number(r.paid) : 0;
                    return (
                      <TR key={r.id} className="relative">
                        <TD className="whitespace-nowrap font-medium">
                          <Link href={`/app/ventas/${r.id}`} className="after:absolute after:inset-0">
                            {r.fullNumber ?? <span className="text-muted-foreground">Borrador</span>}
                          </Link>
                          {r.kind !== "normal" && vista === "facturas" && <Badge className="ml-2">{INVOICE_KIND_LABELS[r.kind]}</Badge>}
                        </TD>
                        <TD className="tabular whitespace-nowrap">{r.issueDate ? formatDate(r.issueDate) : "—"}</TD>
                        <TD className="max-w-56 truncate">{r.clientName ?? "—"}</TD>
                        <TD className="tabular text-muted-foreground">{r.orderNumber ?? "—"}</TD>
                        <TD className={cn("tabular whitespace-nowrap", r.status === "vencida" && "text-danger")}>{r.dueDate ? formatDate(r.dueDate) : "—"}</TD>
                        <TD className="text-right tabular">{formatEUR(Number(r.subtotal))}</TD>
                        <TD className="text-right tabular font-medium">{formatEUR(Number(r.total))}</TD>
                        <TD className="text-right tabular">{pending > 0.005 ? formatEUR(pending) : "—"}</TD>
                        <TD>
                          <InvoiceStatus status={r.status} draft={!r.fullNumber} />
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
                <tfoot>
                  <tr className="border-t bg-subtle text-sm">
                    <td colSpan={5} className="px-4 py-2.5 text-muted-foreground">
                      {data.rows.length} documentos
                    </td>
                    <td className="px-4 py-2.5 text-right tabular font-medium">{formatEUR(totals.base)}</td>
                    <td className="px-4 py-2.5 text-right tabular font-medium">{formatEUR(totals.total)}</td>
                    <td className="px-4 py-2.5 text-right tabular font-medium">{formatEUR(totals.pend)}</td>
                    <td />
                  </tr>
                </tfoot>
              </Table>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
