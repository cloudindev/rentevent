import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt, ShieldCheck } from "lucide-react";
import { contacts, eq } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { InvoiceActions } from "@/components/finance/invoice-actions";
import { InvoiceEditor, Totals } from "@/components/finance/invoice-editor";
import { InvoiceStatus, PAYMENT_METHODS } from "@/components/finance/status";
import { formatDate, formatEUR, formatNumber } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { invoiceTotals, lineNet } from "@/server/finance/calc";
import { INVOICE_KIND_LABELS, clientSnapshot, parseLines, type ClientSnapshot } from "@/server/finance/invoicing";
import { bankAccountOptions, clientOptions, invoiceDetail } from "@/server/finance/queries";

export const metadata: Metadata = { title: "Factura" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await tenantDb(async (tx) => {
    const d = await invoiceDetail(tx, id);
    if (!d) return null;
    const [clients, accounts, email, liveClient] = await Promise.all([
      clientOptions(tx),
      bankAccountOptions(tx),
      d.inv.clientId ? tx.select({ email: contacts.email }).from(contacts).where(eq(contacts.id, d.inv.clientId)).then((r) => r[0]?.email ?? null) : null,
      d.inv.clientSnapshot ? null : clientSnapshot(tx, d.inv.clientId),
    ]);
    return { ...d, clients, accounts, email, liveClient };
  }, "finanzas");
  if (!data) notFound();
  const { inv } = data;
  const lines = parseLines(inv.lines);
  const totals = invoiceTotals(lines);
  const draft = !inv.fullNumber;
  const client = (inv.clientSnapshot as ClientSnapshot | null) ?? data.liveClient;
  const title = `${INVOICE_KIND_LABELS[inv.kind] ?? "Factura"} ${inv.fullNumber ?? "· borrador"}`;

  return (
    <>
      <PageHeader icon={Receipt} back={{ href: "/app/ventas", label: "Ventas" }} title={title}>
        <InvoiceStatus status={inv.status} draft={draft} />
        <InvoiceActions
          invoice={{ id: inv.id, fullNumber: inv.fullNumber, status: inv.status, kind: inv.kind, total: Number(inv.total), paid: Number(inv.paid), clientEmail: client?.email ?? data.email, rectified: data.rectifiedBy.length > 0 }}
          accounts={data.accounts}
        />
      </PageHeader>
      <PageBody className="max-w-6xl">
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            {draft ? (
              <Card>
                <CardHeader>
                  <CardTitle>Borrador</CardTitle>
                </CardHeader>
                <CardContent>
                  <InvoiceEditor invoiceId={inv.id} clients={data.clients} initial={{ clientId: inv.clientId, lines, notes: inv.notes, dueDate: inv.dueDate }} />
                </CardContent>
              </Card>
            ) : (
              <>
                <Table>
                  <THead>
                    <TR>
                      <TH>Concepto</TH>
                      <TH className="text-right">Cant.</TH>
                      <TH className="text-right">Precio</TH>
                      <TH className="text-right">Dto.</TH>
                      <TH className="text-right">IVA</TH>
                      <TH className="text-right">Importe</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {lines.map((l, i) => (
                      <TR key={i}>
                        <TD>{l.description}</TD>
                        <TD className="text-right tabular">{formatNumber(l.quantity)}</TD>
                        <TD className="text-right tabular">{formatEUR(l.unitPrice)}</TD>
                        <TD className="text-right tabular">{l.discountPct ? `${formatNumber(l.discountPct)} %` : "—"}</TD>
                        <TD className="text-right tabular">{l.taxRate} %</TD>
                        <TD className="text-right tabular font-medium">{formatEUR(lineNet(l))}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                <div className="flex justify-end">
                  <Totals totals={totals} paid={Number(inv.paid)} />
                </div>
                {inv.notes && <p className="rounded-xl border bg-subtle p-4 text-sm text-muted-foreground">{inv.notes}</p>}
              </>
            )}

            {!draft && (
              <Card>
                <CardHeader>
                  <CardTitle>Cobros</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Todavía no hay cobros registrados.</p>
                  ) : (
                    <ul className="divide-y text-sm">
                      {data.payments.map((p) => (
                        <li key={p.id} className="flex items-center justify-between py-2">
                          <span>
                            {formatDate(p.paidOn)} · {PAYMENT_METHODS[p.method] ?? p.method}
                            {p.reference ? <span className="text-muted-foreground"> · {p.reference}</span> : null}
                          </span>
                          <span className="tabular font-medium">{formatEUR(Number(p.amount))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-4">
            <Card>
              <CardContent className="space-y-3 pt-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{client?.legalName || client?.name || "Sin cliente"}</p>
                  {client?.taxId ? <p>NIF {client.taxId}</p> : <p className="text-warning">Sin NIF</p>}
                  {client?.address && <p className="text-muted-foreground">{client.address}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="tabular">{inv.issueDate ? formatDate(inv.issueDate) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vencimiento</p>
                    <p className="tabular">{inv.dueDate ? formatDate(inv.dueDate) : "—"}</p>
                  </div>
                </div>
                {data.order && (
                  <div>
                    <p className="text-xs text-muted-foreground">Pedido</p>
                    <Link className="text-link hover:underline" href={`/app/pedidos/${data.order.id}`}>
                      {data.order.number} · {data.order.title}
                    </Link>
                  </div>
                )}
                {data.rectifies && (
                  <div>
                    <p className="text-xs text-muted-foreground">Rectifica a</p>
                    <Link className="text-link hover:underline" href={`/app/ventas/${data.rectifies.id}`}>
                      {data.rectifies.fullNumber}
                    </Link>
                    {inv.rectificationReason && <p className="text-muted-foreground">{inv.rectificationReason}</p>}
                  </div>
                )}
                {data.rectifiedBy.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Rectificada por</p>
                    {data.rectifiedBy.map((r) => (
                      <Link key={r.id} className="block text-link hover:underline" href={`/app/ventas/${r.id}`}>
                        {r.fullNumber ?? "Borrador"}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            {!draft && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-muted-foreground" /> Registro Verifactu
                  </CardTitle>
                  <Badge>{inv.verifactuStatus === "simulada" ? "Simulado" : inv.verifactuStatus.replace("_", " ")}</Badge>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Huella</p>
                    <p className="break-all font-mono">{inv.recordHash ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Huella anterior</p>
                    <p className="break-all font-mono">{inv.previousHash ?? "Primer registro"}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </PageBody>
    </>
  );
}
