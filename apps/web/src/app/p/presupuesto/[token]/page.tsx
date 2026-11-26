import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, orders, quotes, withTenant } from "@rentevent/db";
import { normalizeSnapshot } from "@/server/pdf/quote";
import { compositionSchema } from "@rentevent/core";
import { loadCatalog } from "@/server/catalog";
import { findQuoteByToken, quoteBlock } from "@/server/public-quote";
import { formatEUR, formatRange, initials } from "@/lib/utils";
import { PublicQuoteClient } from "./client";

export const metadata: Metadata = { title: "Presupuesto", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const q = await findQuoteByToken(token);
  if (!q) notFound();
  const d = await withTenant(q.tenantId, async (tx) => {
    const [row] = await tx.select().from(quotes).where(eq(quotes.id, q.id));
    if (row && !row.viewedAt) await tx.update(quotes).set({ viewedAt: new Date() }).where(eq(quotes.id, q.id));
    const [order] = await tx.select().from(orders).where(eq(orders.id, row!.orderId));
    const blocked = row!.status === "aceptado" || !order ? null : await quoteBlock(tx, row!, order.status);
    return { row: row!, order, blocked, cat: await loadCatalog(tx, { includeInactive: true }) };
  });
  const snap = normalizeSnapshot(d.row.snapshot, d.order);
  const comps = snap.tents.map((t) => compositionSchema.safeParse(t.composition)).filter((r) => r.success).map((r) => r.data!);
  const composition = comps.length ? { version: 1 as const, tents: comps.flatMap((c) => c.tents), gutters: comps.flatMap((c) => c.gutters), site: null } : null;
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          {q.logo ? <img src={q.logo} alt={q.tenantName} className="h-8 w-auto" /> : <span className="flex size-9 items-center justify-center rounded-lg bg-ink text-xs font-semibold text-white">{initials(q.tenantName)}</span>}
          <span className="font-semibold">{q.tenantName}</span>
          <a href={`/p/presupuesto/${token}/pdf`} className="ml-auto text-sm text-link hover:underline">Descargar PDF</a>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <p className="text-sm text-muted-foreground">Presupuesto {d.row.number}</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">{snap.title}</h1>
          <p className="mt-1 text-muted-foreground">{formatRange(snap.eventStart, snap.eventEnd)}</p>
        </div>
        <PublicQuoteClient
          token={token}
          composition={composition}
          families={d.cat.families}
          items={d.cat.items}
          rules={d.cat.rules}
          accepted={d.row.status === "aceptado"}
          signer={d.row.signatureName}
          blocked={d.blocked}
          expired={Boolean(d.row.validUntil && d.row.validUntil < new Date().toISOString().slice(0, 10))}
        />
        <section className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-subtle text-[13px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-normal">Concepto</th>
                <th className="px-4 py-2.5 text-right font-normal">Cantidad</th>
                <th className="px-4 py-2.5 text-right font-normal">Importe</th>
              </tr>
            </thead>
            <tbody>
              {snap.rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className={`px-4 py-2.5 ${r.kind === "carpa" ? "font-medium" : r.kind === "suplemento" ? "pl-8 text-muted-foreground" : ""}`}>{r.description}</td>
                  <td className="tabular px-4 py-2.5 text-right">{r.quantity}{r.priceMode === "m2" ? " m²" : ""}</td>
                  <td className="tabular px-4 py-2.5 text-right">{formatEUR(r.quantity * r.unitPrice * (1 - r.discountPct / 100))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-subtle text-sm">
              <tr><td className="px-4 py-2 text-muted-foreground" colSpan={2}>Base imponible</td><td className="tabular px-4 py-2 text-right">{formatEUR(snap.totals.taxable)}</td></tr>
              <tr><td className="px-4 py-2 text-muted-foreground" colSpan={2}>IVA</td><td className="tabular px-4 py-2 text-right">{formatEUR(snap.totals.vat)}</td></tr>
              <tr className="text-base font-semibold"><td className="px-4 py-3" colSpan={2}>Total</td><td className="tabular px-4 py-3 text-right">{formatEUR(snap.totals.total)}</td></tr>
            </tfoot>
          </table>
        </section>
        {snap.terms && (
          <section className="rounded-xl border bg-card p-5 text-sm">
            <h2 className="mb-2 font-semibold">Condiciones</h2>
            <p className="whitespace-pre-wrap text-muted-foreground">{snap.terms}</p>
          </section>
        )}
        <p className="text-center text-xs text-muted-foreground">Presupuesto generado con Rentevent</p>
      </main>
    </div>
  );
}
