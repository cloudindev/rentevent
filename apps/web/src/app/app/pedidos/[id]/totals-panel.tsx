"use client";
import { TriangleAlert } from "lucide-react";
import type { QuoteTotals } from "@rentevent/core";
import type { PricedRow } from "@/lib/order-model";
import type { OrderWorkspaceData } from "@/server/orders";
import { formatEUR } from "@/lib/utils";

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "text-base font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted-foreground"}>{k}</dt>
      <dd className="tabular">{v}</dd>
    </div>
    );
}

export function TotalsPanel({ totals, rows, showMargin, shortTotal, order, days }: { totals: QuoteTotals; rows: PricedRow[]; showMargin: boolean; shortTotal: number; order: OrderWorkspaceData["order"]; days: number }) {
  return (
    <section className="rounded-xl border bg-card p-4" aria-label="Totales">
      <h3 className="mb-3 text-sm font-semibold">Precio</h3>
      {shortTotal > 0 && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-xs text-danger">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> Faltan {shortTotal} unidades en las fechas del pedido. Revisa las alternativas en la carpa o crea un subalquiler.
        </p>
      )}
      <dl className="space-y-1.5 text-sm">
        <Row k="Subtotal" v={formatEUR(totals.gross)} />
        {totals.lineDiscounts > 0 && <Row k="Descuentos de línea" v={`− ${formatEUR(totals.lineDiscounts)}`} />}
        {totals.globalDiscount > 0 && <Row k={`Descuento cliente (${order.discountPct} %)`} v={`− ${formatEUR(totals.globalDiscount)}`} />}
        <Row k="Base imponible" v={formatEUR(totals.taxable)} />
        {totals.vatBreakdown.map((v) => (
          <Row key={v.rate} k={`IVA ${v.rate} %`} v={formatEUR(v.amount)} />
        ))}
        <div className="my-2 border-t" />
        <Row k="Total" v={formatEUR(totals.total)} strong />
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        {days} día{days > 1 ? "s" : ""} de evento{order.holiday ? " · suplemento festivo" : ""} · {rows.length} conceptos facturables
      </p>
      {showMargin && (
        <div className="mt-3 rounded-lg bg-subtle p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Coste estimado</span>
            <span className="tabular">{formatEUR(totals.cost)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Margen</span>
            <span className={`tabular ${totals.marginPct < 20 ? "text-danger" : "text-success"}`}>
              {formatEUR(totals.margin)} · {totals.marginPct} %
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Personal, transporte y subalquiler. Solo visible para roles autorizados.</p>
        </div>
      )}
    </section>
  );
}
