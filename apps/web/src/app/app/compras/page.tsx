import type { Metadata } from "next";
import Link from "next/link";
import { Download, ShoppingCart } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FilterBar } from "@/components/finance/filter-bar";
import { PurchaseDialog, PurchaseRowActions, type PurchaseValue } from "@/components/finance/purchase-dialog";
import { Kpi, PURCHASE_CATEGORIES, PurchaseStatus } from "@/components/finance/status";
import { formatDate, formatEUR } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { todayMadrid } from "@/server/finance/calc";
import { listPurchases, purchaseFormOptions } from "@/server/finance/queries";

export const metadata: Metadata = { title: "Compras" };

type SP = { estado?: string; categoria?: string; q?: string; desde?: string; hasta?: string };

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { rows, options } = await tenantDb(async (tx) => {
    const [rows, options] = await Promise.all([listPurchases(tx, sp), purchaseFormOptions(tx)]);
    return { rows, options };
  }, "finanzas");
  const today = todayMadrid();
  const pending = rows.filter((r) => r.p.status !== "pagada");
  const overdue = pending.filter((r) => (r.p.dueDate ?? r.p.issueDate) < today);
  const subrentalCost = rows.filter((r) => r.p.category === "subalquiler").reduce((s, r) => s + Number(r.p.base), 0);
  const year = today.slice(0, 4);
  return (
    <>
      <PageHeader icon={ShoppingCart} title="Compras" subtitle="Facturas de proveedor, gastos y subalquileres">
        <Button asChild variant="outline" size="sm">
          <a href={`/app/compras/export?desde=${sp.desde ?? `${year}-01-01`}&hasta=${sp.hasta ?? `${year}-12-31`}`}>
            <Download /> Libro de recibidas
          </a>
        </Button>
        <PurchaseDialog options={options} />
      </PageHeader>
      <PageBody>
        <div className="grid gap-3 sm:grid-cols-4">
          <Kpi label="Pendiente de pago" value={formatEUR(pending.reduce((s, r) => s + Number(r.p.total), 0))} hint={`${pending.length} documentos`} />
          <Kpi label="Vencido" value={formatEUR(overdue.reduce((s, r) => s + Number(r.p.total), 0))} tone={overdue.length ? "danger" : undefined} hint={`${overdue.length} documentos`} />
          <Kpi label="Coste de subalquiler" value={formatEUR(subrentalCost)} hint="Imputado a proyectos" />
          <Kpi label="Base en la vista" value={formatEUR(rows.reduce((s, r) => s + Number(r.p.base), 0))} hint={`${rows.length} documentos`} />
        </div>
        <FilterBar
          resetHref="/app/compras"
          values={sp}
          fields={[
            { type: "search", name: "q", placeholder: "Concepto, número o proveedor" },
            { type: "select", name: "estado", label: "Estado", options: [{ value: "pendiente", label: "Pendiente" }, { value: "pagada", label: "Pagada" }] },
            { type: "select", name: "categoria", label: "Categoría", options: Object.entries(PURCHASE_CATEGORIES).map(([value, label]) => ({ value, label })) },
            { type: "date", name: "desde", label: "Desde" },
            { type: "date", name: "hasta", label: "Hasta" },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Sin compras" description="Registra facturas de proveedor y gastos, e imputa su coste a cada proyecto." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Fecha</TH>
                <TH>Proveedor</TH>
                <TH>Concepto</TH>
                <TH>Categoría</TH>
                <TH>Proyecto</TH>
                <TH className="text-right">Base</TH>
                <TH className="text-right">Total</TH>
                <TH>Estado</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {rows.map(({ p, supplierName, projectName }) => {
                const value: PurchaseValue = {
                  id: p.id,
                  kind: p.kind as PurchaseValue["kind"],
                  supplierId: p.supplierId ?? "",
                  projectId: p.projectId ?? "",
                  subrentalId: p.subrentalId ?? "",
                  number: p.number ?? "",
                  issueDate: p.issueDate,
                  dueDate: p.dueDate ?? "",
                  concept: p.concept,
                  category: (p.category in PURCHASE_CATEGORIES ? p.category : "general") as PurchaseValue["category"],
                  base: Number(p.base),
                  vatRate: Number(p.base) ? Math.round((Number(p.vat) / Number(p.base)) * 100) : 21,
                };
                return (
                  <TR key={p.id}>
                    <TD className="whitespace-nowrap tabular">{formatDate(p.issueDate)}</TD>
                    <TD className="max-w-44 truncate" title={supplierName ?? undefined}>{supplierName ?? "—"}</TD>
                    <TD className="min-w-56">
                      <span className="line-clamp-2">{p.concept}</span>
                      {p.number && <span className="text-xs text-muted-foreground">{p.number}</span>}
                    </TD>
                    <TD className="text-muted-foreground">{PURCHASE_CATEGORIES[p.category] ?? p.category}</TD>
                    <TD className="max-w-44 truncate">{p.projectId ? <Link className="hover:underline" href={`/app/proyectos/${p.projectId}`}>{projectName}</Link> : "—"}</TD>
                    <TD className="text-right tabular">{formatEUR(Number(p.base))}</TD>
                    <TD className="text-right tabular font-medium">{formatEUR(Number(p.total))}</TD>
                    <TD>
                      <PurchaseStatus status={p.status} />
                    </TD>
                    <TD>
                      <PurchaseRowActions value={value} status={p.status} total={Number(p.total)} options={options} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </PageBody>
    </>
  );
}
