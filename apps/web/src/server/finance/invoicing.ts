import "server-only";
import {
  and,
  asc,
  bankMovements,
  contactAddresses,
  contacts,
  desc,
  eq,
  inArray,
  invoiceSeries,
  invoices,
  isNotNull,
  lt,
  orderLines,
  orders,
  payments,
  sql,
  tenantSettings,
  type Tx,
} from "@rentevent/db";
import { DEFAULT_PRICING, priceLine, type PriceMode, type PricingSettings } from "@rentevent/core";
import type { AppContext } from "../context";
import { audit } from "../audit";
import { UserError } from "../action";
import {
  addDaysIso,
  advanceDeductionLines,
  advanceLines,
  formatFullNumber,
  invoiceTotals,
  negateLines,
  todayMadrid,
  type InvoiceLine,
} from "./calc";
import { verifactuHash } from "./hash";

type Ctx = Pick<AppContext, "user">;
export type InvoiceKind = "normal" | "anticipo" | "rectificativa";

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  borrador: "Borrador",
  emitida: "Emitida",
  cobrada: "Cobrada",
  vencida: "Vencida",
  anulada: "Anulada",
};
export const INVOICE_KIND_LABELS: Record<string, string> = { normal: "Factura", anticipo: "Anticipo", rectificativa: "Rectificativa" };
export const SERIES_CODE: Record<InvoiceKind, string> = { normal: "F", anticipo: "A", rectificativa: "R" };
const SERIES_NAME: Record<InvoiceKind, string> = { normal: "Facturas", anticipo: "Anticipos", rectificativa: "Rectificativas" };

export type ClientSnapshot = { name: string; legalName: string | null; taxId: string | null; email: string | null; address: string | null };

export async function clientSnapshot(tx: Tx, clientId: string | null): Promise<ClientSnapshot | null> {
  if (!clientId) return null;
  const [c] = await tx.select().from(contacts).where(eq(contacts.id, clientId));
  if (!c) return null;
  const [addr] = await tx.select().from(contactAddresses).where(eq(contactAddresses.contactId, clientId)).orderBy(desc(contactAddresses.isDefault)).limit(1);
  const address = addr ? [addr.line1, [addr.postalCode, addr.city].filter(Boolean).join(" "), addr.province].filter(Boolean).join(", ") : null;
  return { name: c.name, legalName: c.legalName, taxId: c.taxId, email: c.email, address };
}

export function parseLines(raw: unknown): InvoiceLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l: Record<string, unknown>) => ({
    description: String(l.description ?? ""),
    quantity: Number(l.quantity ?? 0),
    unitPrice: Number(l.unitPrice ?? 0),
    discountPct: Number(l.discountPct ?? 0),
    taxRate: Number(l.taxRate ?? 21),
  }));
}

async function pricingSettings(tx: Tx): Promise<PricingSettings> {
  const [s] = await tx.select({ pricing: tenantSettings.pricing }).from(tenantSettings);
  return { ...DEFAULT_PRICING, ...((s?.pricing as Partial<PricingSettings>) ?? {}) };
}

/** Billable lines of an order (BOM sub-lines and included items excluded). */
export async function orderInvoiceLines(tx: Tx, orderId: string): Promise<{ lines: InvoiceLine[]; order: typeof orders.$inferSelect }> {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new UserError("Pedido no encontrado");
  const rows = await tx.select().from(orderLines).where(eq(orderLines.orderId, orderId)).orderBy(asc(orderLines.sortOrder));
  const settings = await pricingSettings(tx);
  const start = order.eventStart ?? order.periodStart;
  const end = order.eventEnd ?? order.periodEnd;
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
  const globalDiscount = Number(order.discountPct ?? 0);
  const lines: InvoiceLine[] = [];
  for (const l of rows) {
    if (l.fromBom || l.kind === "texto" || l.priceMode === "incluido") continue;
    const p = priceLine(
      { kind: l.kind as never, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), priceMode: l.priceMode as PriceMode, discountPct: 0 },
      { days, holiday: order.holiday, settings },
    );
    if (p.gross === 0) continue;
    const lineDisc = Number(l.discountPct ?? 0);
    const combined = Math.round((1 - (1 - lineDisc / 100) * (1 - globalDiscount / 100)) * 10000) / 100;
    const qty = Number(l.quantity);
    lines.push({
      description: p.factor !== 1 ? `${l.description} (${days} día${days > 1 ? "s" : ""})` : l.description,
      quantity: qty,
      unitPrice: qty !== 0 ? Math.round((p.gross / qty) * 10000) / 10000 : 0,
      discountPct: combined,
      taxRate: Number(l.taxRate ?? settings.vatRate),
    });
  }
  return { lines, order };
}

async function issuedAdvances(tx: Tx, orderId: string) {
  return tx
    .select()
    .from(invoices)
    .where(and(eq(invoices.orderId, orderId), eq(invoices.kind, "anticipo"), isNotNull(invoices.fullNumber)));
}

/**
 * Creates a draft invoice from an order. `kind: "anticipo"` bills `percent`
 * (default: the company's booking %) of the base; a final invoice deducts issued advances.
 */
export async function createInvoiceFromOrder(tx: Tx, ctx: Ctx, input: { orderId: string; kind: "normal" | "anticipo"; percent?: number }) {
  const { lines: orderLinesBilled, order } = await orderInvoiceLines(tx, input.orderId);
  if (orderLinesBilled.length === 0) throw new UserError("El pedido no tiene líneas facturables");
  let lines: InvoiceLine[];
  if (input.kind === "anticipo") {
    const t = invoiceTotals(orderLinesBilled);
    const pct = input.percent ?? (await pricingSettings(tx)).depositPct;
    lines = advanceLines(t.breakdown, pct, `Anticipo pedido ${order.number} · ${order.title}`);
  } else {
    const advances = await issuedAdvances(tx, order.id);
    lines = [...orderLinesBilled, ...advanceDeductionLines(advances.map((a) => ({ fullNumber: a.fullNumber!, lines: parseLines(a.lines) })))];
  }
  const totals = invoiceTotals(lines);
  const [inv] = await tx
    .insert(invoices)
    .values({
      kind: input.kind,
      status: "borrador",
      clientId: order.clientId,
      orderId: order.id,
      projectId: order.projectId,
      clientSnapshot: await clientSnapshot(tx, order.clientId),
      lines,
      subtotal: totals.subtotal,
      vat: totals.vat,
      total: totals.total,
    })
    .returning();
  await audit(tx, ctx, "invoice", inv!.id, "crear", { desdePedido: order.number, tipo: input.kind });
  return inv!;
}

export async function createBlankInvoice(tx: Tx, ctx: Ctx, input: { clientId: string | null; lines?: InvoiceLine[] }) {
  const lines = input.lines ?? [{ description: "", quantity: 1, unitPrice: 0, discountPct: 0, taxRate: (await pricingSettings(tx)).vatRate }];
  const totals = invoiceTotals(lines);
  const [inv] = await tx
    .insert(invoices)
    .values({ kind: "normal", status: "borrador", clientId: input.clientId, clientSnapshot: await clientSnapshot(tx, input.clientId), lines, subtotal: totals.subtotal, vat: totals.vat, total: totals.total })
    .returning();
  await audit(tx, ctx, "invoice", inv!.id, "crear", { manual: true });
  return inv!;
}

async function draftOrThrow(tx: Tx, invoiceId: string) {
  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!inv) throw new UserError("Factura no encontrada");
  if (inv.fullNumber) throw new UserError("Una factura emitida no se puede modificar: emite una rectificativa");
  return inv;
}

export async function updateDraftInvoice(
  tx: Tx,
  ctx: Ctx,
  input: { invoiceId: string; clientId: string | null; lines: InvoiceLine[]; notes: string | null; dueDate: string | null; seriesId?: string | null },
) {
  const inv = await draftOrThrow(tx, input.invoiceId);
  if (input.seriesId) {
    const [s] = await tx.select({ kind: invoiceSeries.kind }).from(invoiceSeries).where(eq(invoiceSeries.id, input.seriesId));
    if (!s) throw new UserError("Serie no encontrada");
    if (s.kind !== inv.kind) throw new UserError("La serie elegida es de otro tipo de documento");
  }
  const totals = invoiceTotals(input.lines);
  const snapshot = input.clientId !== inv.clientId || !inv.clientSnapshot ? await clientSnapshot(tx, input.clientId) : inv.clientSnapshot;
  await tx
    .update(invoices)
    .set({
      clientId: input.clientId,
      clientSnapshot: snapshot,
      lines: input.lines,
      subtotal: totals.subtotal,
      vat: totals.vat,
      total: totals.total,
      notes: input.notes,
      dueDate: input.dueDate,
      ...(input.seriesId !== undefined ? { seriesId: input.seriesId } : {}),
    })
    .where(eq(invoices.id, inv.id));
  await audit(tx, ctx, "invoice", inv.id, "editar", { total: { de: inv.total, a: totals.total } });
}

export async function deleteDraftInvoice(tx: Tx, ctx: Ctx, invoiceId: string) {
  const inv = await draftOrThrow(tx, invoiceId);
  await tx.delete(invoices).where(eq(invoices.id, inv.id));
  await audit(tx, ctx, "invoice", inv.id, "borrar");
}

/**
 * Series for a kind and year, created on demand, locked FOR UPDATE. A draft may
 * carry a chosen series (`seriesId`); if it belongs to another year, the same
 * code is used for the issue year. Without one, the default F / A / R series.
 */
async function lockSeries(tx: Tx, kind: InvoiceKind, year: number, seriesId?: string | null) {
  let code = SERIES_CODE[kind];
  let name = SERIES_NAME[kind];
  if (seriesId) {
    const [s] = await tx.select().from(invoiceSeries).where(eq(invoiceSeries.id, seriesId)).for("update");
    if (s && s.kind === kind) {
      if (s.year === year) return s;
      code = s.code;
      name = s.name;
    }
  }
  await tx
    .insert(invoiceSeries)
    .values({ code, name, kind, year, nextNumber: 1 })
    .onConflictDoNothing();
  const [s] = await tx
    .select()
    .from(invoiceSeries)
    .where(and(eq(invoiceSeries.code, code), eq(invoiceSeries.year, year)))
    .for("update");
  return s!;
}

/**
 * Issues a draft: assigns the next number of its series atomically, fixes the
 * issue date, computes the chained Verifactu fingerprint. Immutable afterwards.
 */
export async function issueInvoice(tx: Tx, ctx: Ctx, invoiceId: string) {
  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update");
  if (!inv) throw new UserError("Factura no encontrada");
  if (inv.fullNumber) throw new UserError("La factura ya está emitida");
  const lines = parseLines(inv.lines);
  if (lines.length === 0 || lines.every((l) => l.quantity === 0)) throw new UserError("La factura no tiene líneas");
  if (lines.some((l) => !l.description.trim())) throw new UserError("Todas las líneas necesitan descripción");
  if (!inv.clientId) throw new UserError("Selecciona un cliente antes de emitir");
  const snapshot = (inv.clientSnapshot as ClientSnapshot | null) ?? (await clientSnapshot(tx, inv.clientId));
  if (inv.kind !== "rectificativa" && Math.abs(inv.total) >= 400 && !snapshot?.taxId) {
    throw new UserError("El cliente necesita NIF para emitir una factura completa");
  }
  const today = todayMadrid();
  const year = Number(today.slice(0, 4));
  const series = await lockSeries(tx, inv.kind as InvoiceKind, year, inv.seriesId);
  const number = series.nextNumber;
  await tx.update(invoiceSeries).set({ nextNumber: number + 1 }).where(eq(invoiceSeries.id, series.id));
  const fullNumber = formatFullNumber(series.code, year, number);
  const [settings] = await tx.select({ taxId: tenantSettings.taxId }).from(tenantSettings);
  // chain: lock the tenant's issued invoices ordering by taking the latest hash
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(current_setting('app.tenant_id', true) || ':verifactu'))`);
  // tail of the chain: the issued record no other record points to
  const tail = await tx.execute<{ record_hash: string }>(sql`
    select i.record_hash from invoices i
    where i.record_hash is not null
      and not exists (select 1 from invoices j where j.previous_hash = i.record_hash)
    order by i.issue_date desc nulls last, i.created_at desc limit 1`);
  const prev = tail.rows[0] ? { recordHash: tail.rows[0].record_hash } : undefined;
  const totals = invoiceTotals(lines);
  const recordHash = verifactuHash({ taxId: settings?.taxId ?? "", fullNumber, issueDate: today, total: totals.total, previousHash: prev?.recordHash ?? null });
  let terms = 30;
  if (inv.clientId) {
    const [c] = await tx.select({ t: contacts.paymentTermsDays }).from(contacts).where(eq(contacts.id, inv.clientId));
    terms = c?.t ?? 30;
  }
  const [updated] = await tx
    .update(invoices)
    .set({
      seriesId: series.id,
      number,
      fullNumber,
      status: inv.kind === "rectificativa" && totals.total <= 0 ? "cobrada" : "emitida",
      issueDate: today,
      dueDate: inv.dueDate ?? addDaysIso(today, terms),
      clientSnapshot: snapshot,
      subtotal: totals.subtotal,
      vat: totals.vat,
      total: totals.total,
      recordHash,
      previousHash: prev?.recordHash ?? null,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, inv.id))
    .returning();
  if (inv.kind === "rectificativa" && inv.rectifiesId) {
    const [orig] = await tx.select().from(invoices).where(eq(invoices.id, inv.rectifiesId));
    if (orig && Math.abs(orig.total + totals.total) < 0.01) await tx.update(invoices).set({ status: "anulada" }).where(eq(invoices.id, orig.id));
  }
  await audit(tx, ctx, "invoice", inv.id, "estado", { emitida: fullNumber, huella: recordHash });
  return updated!;
}

/** Corrective invoice (series R) referencing an issued invoice; by default cancels it in full. */
export async function createRectification(tx: Tx, ctx: Ctx, input: { invoiceId: string; reason: string; lines?: InvoiceLine[] }) {
  const [orig] = await tx.select().from(invoices).where(eq(invoices.id, input.invoiceId));
  if (!orig) throw new UserError("Factura no encontrada");
  if (!orig.fullNumber) throw new UserError("Solo se rectifican facturas emitidas");
  if (orig.kind === "rectificativa") throw new UserError("No se puede rectificar una rectificativa");
  const lines = input.lines?.length ? input.lines.map((l) => ({ ...l, quantity: -Math.abs(l.quantity) })) : negateLines(parseLines(orig.lines));
  const totals = invoiceTotals(lines);
  const [inv] = await tx
    .insert(invoices)
    .values({
      kind: "rectificativa",
      status: "borrador",
      clientId: orig.clientId,
      orderId: orig.orderId,
      projectId: orig.projectId,
      rectifiesId: orig.id,
      rectificationReason: input.reason,
      clientSnapshot: orig.clientSnapshot,
      lines,
      subtotal: totals.subtotal,
      vat: totals.vat,
      total: totals.total,
      notes: `Rectifica la factura ${orig.fullNumber} de ${orig.issueDate}. Motivo: ${input.reason}`,
    })
    .returning();
  await audit(tx, ctx, "invoice", inv!.id, "crear", { rectifica: orig.fullNumber, motivo: input.reason });
  return inv!;
}

export async function registerPayment(
  tx: Tx,
  ctx: Ctx,
  input: { invoiceId: string; amount: number; paidOn: string; method: string; bankAccountId: string | null; reference: string | null; createMovement: boolean; movementId?: string | null },
) {
  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, input.invoiceId)).for("update");
  if (!inv) throw new UserError("Factura no encontrada");
  if (!inv.fullNumber) throw new UserError("Emite la factura antes de registrar cobros");
  if (input.amount === 0) throw new UserError("El importe no puede ser cero");
  const [pay] = await tx
    .insert(payments)
    .values({ invoiceId: inv.id, amount: input.amount, paidOn: input.paidOn, method: input.method, bankAccountId: input.bankAccountId, reference: input.reference ?? inv.fullNumber })
    .returning();
  const paid = Math.round((Number(inv.paid) + input.amount) * 100) / 100;
  const full = paid >= Number(inv.total) - 0.005;
  await tx
    .update(invoices)
    .set({ paid, status: full ? "cobrada" : inv.status === "cobrada" ? "emitida" : inv.status })
    .where(eq(invoices.id, inv.id));
  if (input.movementId) {
    await tx.update(bankMovements).set({ invoiceId: inv.id, reconciled: true }).where(eq(bankMovements.id, input.movementId));
  } else if (input.createMovement && input.bankAccountId) {
    await tx.insert(bankMovements).values({ accountId: input.bankAccountId, bookedOn: input.paidOn, concept: `Cobro ${inv.fullNumber}`, amount: input.amount, invoiceId: inv.id, reconciled: true, category: "cobros" });
  }
  await audit(tx, ctx, "invoice", inv.id, "editar", { cobro: input.amount, cobrado: paid });
  return pay!;
}

/** Marks issued, unpaid invoices past their due date as overdue. Returns how many changed. */
export async function refreshOverdue(tx: Tx) {
  const today = todayMadrid();
  const rows = await tx
    .update(invoices)
    .set({ status: "vencida" })
    .where(and(eq(invoices.status, "emitida"), lt(invoices.dueDate, today), sql`${invoices.paid} < ${invoices.total} - 0.005`))
    .returning({ id: invoices.id });
  return rows.length;
}

export async function invoicesByIds(tx: Tx, ids: string[]) {
  if (ids.length === 0) return [];
  return tx.select().from(invoices).where(inArray(invoices.id, ids));
}
