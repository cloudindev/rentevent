import Link from "next/link";
import { asc, desc, eq, invoiceSeries, orderLines, sql } from "@rentevent/db";
import { PageBody } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { tenantDb } from "@/server/context";
import { tenantPricing } from "@/server/orders";

export const metadata = { title: "Impuestos y series" };
const KIND: Record<string, string> = { normal: "Facturas", rectificativa: "Rectificativas", anticipo: "Anticipos" };

export default async function TaxesPage() {
  const year = new Date().getFullYear();
  const d = await tenantDb(async (tx) => ({
    pricing: (await tenantPricing(tx)).pricing,
    rates: await tx.select({ rate: orderLines.taxRate, n: sql<number>`count(*)::int` }).from(orderLines).groupBy(orderLines.taxRate).orderBy(desc(orderLines.taxRate)),
    series: await tx.select().from(invoiceSeries).where(eq(invoiceSeries.year, year)).orderBy(asc(invoiceSeries.code)),
  }), "configuracion");
  const rates = [...new Set([d.pricing.vatRate, 10, 4, 0, ...d.rates.map((r) => Number(r.rate))])].sort((a, b) => b - a);
  return (
    <PageBody className="max-w-4xl">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Tipos de IVA</CardTitle>
            <CardDescription>El tipo general se aplica por defecto a todas las líneas (cámbialo en Tarifas). Las líneas pueden llevar un tipo distinto.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {rates.map((r) => (
            <StatusPill key={r} tone={r === d.pricing.vatRate ? "brand" : "neutral"}>
              IVA {r} %{r === d.pricing.vatRate ? " · general" : r === 10 ? " · reducido" : r === 4 ? " · superreducido" : r === 0 ? " · exento" : ""}
              {d.rates.find((x) => Number(x.rate) === r) ? ` · ${d.rates.find((x) => Number(x.rate) === r)!.n} líneas` : ""}
            </StatusPill>
          ))}
        </CardContent>
      </Card>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Series de facturación {year}</h2>
          <Link href="/app/ventas?vista=series" className="text-sm text-link hover:underline">Gestionar series</Link>
        </div>
        <Table>
          <THead><TR><TH>Serie</TH><TH>Nombre</TH><TH>Tipo</TH><TH className="text-right">Próximo número</TH></TR></THead>
          <TBody>
            {d.series.map((s) => (
              <TR key={s.id}><TD className="font-mono">{s.code}{s.year}</TD><TD>{s.name}</TD><TD>{KIND[s.kind] ?? s.kind}</TD><TD className="tabular text-right">{s.nextNumber}</TD></TR>
            ))}
            {d.series.length === 0 && <TR><TD colSpan={4} className="py-8 text-center text-muted-foreground">No hay series para {year}: se crean al emitir la primera factura.</TD></TR>}
          </TBody>
        </Table>
        <p className="text-xs text-muted-foreground">Numeración correlativa sin huecos y registros encadenados con huella SHA-256, preparados para Verifactu y factura electrónica.</p>
      </section>
    </PageBody>
  );
}
