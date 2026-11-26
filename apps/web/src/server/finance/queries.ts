import "server-only";
import {
  and,
  asc,
  bankAccounts,
  bankMovements,
  contacts,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  invoiceSeries,
  invoices,
  isNotNull,
  lte,
  ne,
  or,
  orderLines,
  orders,
  payments,
  projects,
  purchases,
  quotes,
  shifts,
  sql,
  subrentals,
  timeEntries,
  workers,
  type Tx,
} from "@rentevent/db";
import { addDaysIso, cashForecast, todayMadrid, type CashEvent } from "./calc";

export type InvoiceFilters = { estado?: string; serie?: string; desde?: string; hasta?: string; q?: string; tipo?: string };

export async function listInvoices(tx: Tx, f: InvoiceFilters) {
  const conds = [];
  if (f.estado) conds.push(eq(invoices.status, f.estado));
  if (f.tipo) conds.push(eq(invoices.kind, f.tipo));
  if (f.serie) conds.push(eq(invoices.seriesId, f.serie));
  if (f.desde) conds.push(gte(invoices.issueDate, f.desde));
  if (f.hasta) conds.push(lte(invoices.issueDate, f.hasta));
  if (f.q) conds.push(or(ilike(invoices.fullNumber, `%${f.q}%`), ilike(contacts.name, `%${f.q}%`), ilike(contacts.taxId, `%${f.q}%`)));
  return tx
    .select({
      id: invoices.id,
      fullNumber: invoices.fullNumber,
      kind: invoices.kind,
      status: invoices.status,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      subtotal: invoices.subtotal,
      vat: invoices.vat,
      total: invoices.total,
      paid: invoices.paid,
      clientName: contacts.name,
      clientTaxId: contacts.taxId,
      orderNumber: orders.number,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .leftJoin(contacts, eq(contacts.id, invoices.clientId))
    .leftJoin(orders, eq(orders.id, invoices.orderId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(sql`${invoices.issueDate} desc nulls first`, desc(invoices.number), desc(invoices.createdAt))
    .limit(500);
}

export async function listSeries(tx: Tx) {
  return tx.select().from(invoiceSeries).orderBy(desc(invoiceSeries.year), asc(invoiceSeries.code));
}

export async function invoiceDetail(tx: Tx, id: string) {
  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, id));
  if (!inv) return null;
  const [pays, order, rectifies, rectifiedBy] = await Promise.all([
    tx.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(asc(payments.paidOn)),
    inv.orderId ? tx.select({ id: orders.id, number: orders.number, title: orders.title }).from(orders).where(eq(orders.id, inv.orderId)).then((r) => r[0] ?? null) : null,
    inv.rectifiesId ? tx.select({ id: invoices.id, fullNumber: invoices.fullNumber }).from(invoices).where(eq(invoices.id, inv.rectifiesId)).then((r) => r[0] ?? null) : null,
    tx.select({ id: invoices.id, fullNumber: invoices.fullNumber, status: invoices.status }).from(invoices).where(eq(invoices.rectifiesId, id)),
  ]);
  return { inv, payments: pays, order, rectifies, rectifiedBy };
}

export async function clientOptions(tx: Tx, kind: "cliente" | "proveedor" = "cliente") {
  return tx
    .select({ id: contacts.id, name: contacts.name, taxId: contacts.taxId })
    .from(contacts)
    .where(and(eq(contacts.kind, kind), eq(contacts.archived, false)))
    .orderBy(asc(contacts.name));
}

export async function invoiceableOrders(tx: Tx) {
  return tx
    .select({ id: orders.id, number: orders.number, title: orders.title, status: orders.status, clientName: contacts.name })
    .from(orders)
    .leftJoin(contacts, eq(contacts.id, orders.clientId))
    .where(inArray(orders.status, ["opcion", "confirmado", "en_curso", "devuelto"]))
    .orderBy(desc(orders.periodStart))
    .limit(200);
}

export async function bankAccountOptions(tx: Tx) {
  return tx.select({ id: bankAccounts.id, name: bankAccounts.name }).from(bankAccounts).orderBy(asc(bankAccounts.name));
}

// ───────────── Purchases

export async function listPurchases(tx: Tx, f: { estado?: string; categoria?: string; q?: string; desde?: string; hasta?: string }) {
  const conds = [];
  if (f.estado) conds.push(eq(purchases.status, f.estado));
  if (f.categoria) conds.push(eq(purchases.category, f.categoria));
  if (f.desde) conds.push(gte(purchases.issueDate, f.desde));
  if (f.hasta) conds.push(lte(purchases.issueDate, f.hasta));
  if (f.q) conds.push(or(ilike(purchases.concept, `%${f.q}%`), ilike(purchases.number, `%${f.q}%`), ilike(contacts.name, `%${f.q}%`)));
  return tx
    .select({
      p: purchases,
      supplierName: contacts.name,
      supplierTaxId: contacts.taxId,
      projectName: projects.name,
    })
    .from(purchases)
    .leftJoin(contacts, eq(contacts.id, purchases.supplierId))
    .leftJoin(projects, eq(projects.id, purchases.projectId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(purchases.issueDate))
    .limit(500);
}

export async function purchaseFormOptions(tx: Tx) {
  const [suppliers, projs, subs, accounts] = await Promise.all([
    clientOptions(tx, "proveedor"),
    tx.select({ id: projects.id, name: projects.name, number: projects.number }).from(projects).orderBy(desc(projects.startsAt)).limit(200),
    tx
      .select({ id: subrentals.id, projectId: subrentals.projectId, supplierId: subrentals.supplierId, cost: subrentals.cost, notes: subrentals.notes, startsAt: subrentals.startsAt })
      .from(subrentals)
      .orderBy(desc(subrentals.startsAt))
      .limit(200),
    bankAccountOptions(tx),
  ]);
  return { suppliers, projects: projs, subrentals: subs, accounts };
}

// ───────────── Treasury

export async function accountsWithBalance(tx: Tx) {
  const rows = await tx
    .select({
      id: bankAccounts.id,
      name: bankAccounts.name,
      iban: bankAccounts.iban,
      openingBalance: bankAccounts.openingBalance,
      openingDate: bankAccounts.openingDate,
      moved: sql<number>`coalesce(sum(${bankMovements.amount}) filter (where not ${bankMovements.forecast}), 0)::float`,
      pending: sql<number>`count(${bankMovements.id}) filter (where not ${bankMovements.reconciled} and not ${bankMovements.forecast})::int`,
    })
    .from(bankAccounts)
    .leftJoin(bankMovements, eq(bankMovements.accountId, bankAccounts.id))
    .groupBy(bankAccounts.id)
    .orderBy(asc(bankAccounts.name));
  return rows.map((r) => ({ ...r, balance: Math.round((Number(r.openingBalance) + Number(r.moved)) * 100) / 100 }));
}

export async function accountMovements(tx: Tx, accountId: string) {
  const [acc] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, accountId));
  if (!acc) return null;
  const rows = await tx
    .select({ m: bankMovements, invoiceNumber: invoices.fullNumber, purchaseConcept: purchases.concept })
    .from(bankMovements)
    .leftJoin(invoices, eq(invoices.id, bankMovements.invoiceId))
    .leftJoin(purchases, eq(purchases.id, bankMovements.purchaseId))
    .where(eq(bankMovements.accountId, accountId))
    .orderBy(asc(bankMovements.bookedOn), asc(bankMovements.createdAt));
  let bal = Number(acc.openingBalance);
  const withBalance = rows.map((r) => {
    if (!r.m.forecast) bal = Math.round((bal + Number(r.m.amount)) * 100) / 100;
    return { ...r, balance: bal };
  });
  return { account: acc, movements: withBalance.reverse() };
}

/** Open receivables and payables to suggest reconciliation matches. */
export async function reconciliationCandidates(tx: Tx) {
  const [inv, pur] = await Promise.all([
    tx
      .select({ id: invoices.id, fullNumber: invoices.fullNumber, total: invoices.total, paid: invoices.paid, clientName: contacts.name, dueDate: invoices.dueDate })
      .from(invoices)
      .leftJoin(contacts, eq(contacts.id, invoices.clientId))
      .where(and(isNotNull(invoices.fullNumber), inArray(invoices.status, ["emitida", "vencida"])))
      .orderBy(asc(invoices.dueDate)),
    tx
      .select({ id: purchases.id, concept: purchases.concept, total: purchases.total, supplierName: contacts.name, issueDate: purchases.issueDate })
      .from(purchases)
      .leftJoin(contacts, eq(contacts.id, purchases.supplierId))
      .where(eq(purchases.status, "pendiente"))
      .orderBy(asc(purchases.issueDate)),
  ]);
  return {
    invoices: inv.map((i) => ({ ...i, outstanding: Math.round((Number(i.total) - Number(i.paid)) * 100) / 100 })),
    purchases: pur,
  };
}

/** Next `days` days of cash: current balance + receivables by due date − payables + forecast movements. */
export async function forecast(tx: Tx, days = 90) {
  const today = todayMadrid();
  const accounts = await accountsWithBalance(tx);
  const opening = accounts.reduce((s, a) => s + a.balance, 0);
  const [recv, pay, fm] = await Promise.all([
    tx
      .select({ dueDate: invoices.dueDate, total: invoices.total, paid: invoices.paid })
      .from(invoices)
      .where(and(isNotNull(invoices.fullNumber), inArray(invoices.status, ["emitida", "vencida"]))),
    tx.select({ dueDate: purchases.dueDate, issueDate: purchases.issueDate, total: purchases.total }).from(purchases).where(eq(purchases.status, "pendiente")),
    tx.select({ bookedOn: bankMovements.bookedOn, amount: bankMovements.amount }).from(bankMovements).where(and(eq(bankMovements.forecast, true), gte(bankMovements.bookedOn, today))),
  ]);
  const events: CashEvent[] = [
    // overdue receivables are expected within a week
    ...recv.map((r) => ({ date: !r.dueDate || r.dueDate < today ? addDaysIso(today, 7) : r.dueDate, amount: Number(r.total) - Number(r.paid) })),
    ...pay.map((p) => ({ date: (p.dueDate ?? p.issueDate) < today ? today : (p.dueDate ?? p.issueDate), amount: -Number(p.total) })),
    ...fm.map((m) => ({ date: m.bookedOn, amount: Number(m.amount) })),
  ];
  const series = cashForecast(Math.round(opening * 100) / 100, events.filter((e) => e.date >= today), today, days);
  return {
    opening: Math.round(opening * 100) / 100,
    series,
    receivables: Math.round(recv.reduce((s, r) => s + Number(r.total) - Number(r.paid), 0) * 100) / 100,
    payables: Math.round(pay.reduce((s, p) => s + Number(p.total), 0) * 100) / 100,
  };
}

// ───────────── Dashboard

export async function monthlyRevenue(tx: Tx, months = 12) {
  const today = todayMadrid();
  const [y, m] = today.split("-").map(Number);
  const start = new Date(Date.UTC(y!, m! - months, 1)).toISOString().slice(0, 10);
  const rows = await tx
    .select({
      month: sql<string>`to_char(${invoices.issueDate}::date, 'YYYY-MM')`,
      base: sql<number>`coalesce(sum(${invoices.subtotal}), 0)::float`,
    })
    .from(invoices)
    .where(and(isNotNull(invoices.fullNumber), gte(invoices.issueDate, start), ne(invoices.status, "anulada")))
    .groupBy(sql`1`);
  const byMonth = new Map(rows.map((r) => [r.month, Number(r.base)]));
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(y!, m! - months + i, 1));
    const key = d.toISOString().slice(0, 7);
    return { month: key, label: new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "UTC" }).format(d).replace(".", ""), base: Math.round((byMonth.get(key) ?? 0) * 100) / 100 };
  });
}

export async function receivablesSummary(tx: Tx) {
  const [row] = await tx
    .select({
      pending: sql<number>`coalesce(sum(${invoices.total} - ${invoices.paid}) filter (where ${invoices.status} in ('emitida','vencida')), 0)::float`,
      overdue: sql<number>`coalesce(sum(${invoices.total} - ${invoices.paid}) filter (where ${invoices.status} = 'vencida'), 0)::float`,
      overdueCount: sql<number>`count(*) filter (where ${invoices.status} = 'vencida')::int`,
      drafts: sql<number>`count(*) filter (where ${invoices.fullNumber} is null)::int`,
    })
    .from(invoices);
  return { pending: Number(row?.pending ?? 0), overdue: Number(row?.overdue ?? 0), overdueCount: Number(row?.overdueCount ?? 0), drafts: Number(row?.drafts ?? 0) };
}

export type ProjectMargin = {
  id: string;
  number: string;
  name: string;
  status: string;
  revenue: number;
  revenueSource: "facturado" | "presupuesto";
  linesCost: number;
  subrentalCost: number;
  purchasesCost: number;
  crewCost: number;
  cost: number;
  margin: number;
  marginPct: number;
};

/** Revenue (invoiced, or accepted quote when not yet invoiced) vs estimated cost per project. */
export async function projectMargins(tx: Tx, limit = 25): Promise<ProjectMargin[]> {
  const projs = await tx
    .select({ id: projects.id, number: projects.number, name: projects.name, status: projects.status, startsAt: projects.startsAt })
    .from(projects)
    .where(ne(projects.status, "cancelado"))
    .orderBy(desc(projects.startsAt))
    .limit(limit);
  if (projs.length === 0) return [];
  const ids = projs.map((p) => p.id);
  const [inv, quoteRows, lineCost, subCost, purCost, crew] = await Promise.all([
    tx
      .select({ projectId: invoices.projectId, base: sql<number>`coalesce(sum(${invoices.subtotal}), 0)::float` })
      .from(invoices)
      .where(and(inArray(invoices.projectId, ids), isNotNull(invoices.fullNumber), ne(invoices.status, "anulada")))
      .groupBy(invoices.projectId),
    tx
      .select({ projectId: orders.projectId, orderId: orders.id, version: quotes.version, snapshot: quotes.snapshot, status: orders.status })
      .from(quotes)
      .innerJoin(orders, eq(orders.id, quotes.orderId))
      .where(and(inArray(orders.projectId, ids), ne(orders.status, "cancelado")))
      .orderBy(desc(quotes.version)),
    tx
      .select({ projectId: orders.projectId, cost: sql<number>`coalesce(sum(${orderLines.unitCost} * ${orderLines.quantity}), 0)::float` })
      .from(orderLines)
      .innerJoin(orders, eq(orders.id, orderLines.orderId))
      .where(and(inArray(orders.projectId, ids), ne(orders.status, "cancelado")))
      .groupBy(orders.projectId),
    tx
      .select({ projectId: subrentals.projectId, cost: sql<number>`coalesce(sum(${subrentals.cost}), 0)::float` })
      .from(subrentals)
      .where(and(inArray(subrentals.projectId, ids), ne(subrentals.status, "cancelado")))
      .groupBy(subrentals.projectId),
    tx
      .select({ projectId: purchases.projectId, cost: sql<number>`coalesce(sum(${purchases.base}), 0)::float` })
      .from(purchases)
      // subrental purchases already counted through the subrental cost
      .where(and(inArray(purchases.projectId, ids), sql`${purchases.subrentalId} is null`))
      .groupBy(purchases.projectId),
    tx
      .select({
        projectId: shifts.projectId,
        cost: sql<number>`coalesce(sum(greatest(extract(epoch from (coalesce(${timeEntries.clockOut}, ${timeEntries.clockIn}) - ${timeEntries.clockIn})) / 3600 - ${timeEntries.breakMinutes} / 60.0, 0) * ${workers.costPerHour}), 0)::float`,
      })
      .from(timeEntries)
      .innerJoin(shifts, eq(shifts.id, timeEntries.shiftId))
      .innerJoin(workers, eq(workers.id, timeEntries.workerId))
      .where(inArray(shifts.projectId, ids))
      .groupBy(shifts.projectId),
  ]);
  const m = <T extends { projectId: string | null }>(rows: T[], f: (r: T) => number) => {
    const out = new Map<string, number>();
    for (const r of rows) if (r.projectId) out.set(r.projectId, (out.get(r.projectId) ?? 0) + f(r));
    return out;
  };
  const invM = m(inv, (r) => Number(r.base));
  const seen = new Set<string>();
  const quoteM = m(
    quoteRows.filter((q) => {
      if (seen.has(q.orderId)) return false;
      seen.add(q.orderId);
      return true;
    }),
    (q) => Number((q.snapshot as { totals?: { taxable?: number } })?.totals?.taxable ?? 0),
  );
  const lineM = m(lineCost, (r) => Number(r.cost));
  const subM = m(subCost, (r) => Number(r.cost));
  const purM = m(purCost, (r) => Number(r.cost));
  const crewM = m(crew, (r) => Number(r.cost));
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return projs.map((p) => {
    const invoiced = invM.get(p.id) ?? 0;
    const revenue = r2(invoiced > 0 ? invoiced : (quoteM.get(p.id) ?? 0));
    const linesCost = r2(lineM.get(p.id) ?? 0);
    const subrentalCost = r2(subM.get(p.id) ?? 0);
    const purchasesCost = r2(purM.get(p.id) ?? 0);
    const crewCost = r2(crewM.get(p.id) ?? 0);
    const cost = r2(linesCost + subrentalCost + purchasesCost + crewCost);
    const margin = r2(revenue - cost);
    return {
      id: p.id,
      number: p.number,
      name: p.name,
      status: p.status,
      revenue,
      revenueSource: invoiced > 0 ? "facturado" : "presupuesto",
      linesCost,
      subrentalCost,
      purchasesCost,
      crewCost,
      cost,
      margin,
      marginPct: revenue > 0 ? r2((margin / revenue) * 100) : 0,
    };
  });
}

export async function invoicedInRange(tx: Tx, from: string, to: string) {
  const [row] = await tx
    .select({ base: sql<number>`coalesce(sum(${invoices.subtotal}), 0)::float`, count: sql<number>`count(*)::int` })
    .from(invoices)
    .where(and(isNotNull(invoices.fullNumber), gte(invoices.issueDate, from), lte(invoices.issueDate, to), ne(invoices.status, "anulada")));
  return { base: Number(row?.base ?? 0), count: Number(row?.count ?? 0) };
}

export async function salesBook(tx: Tx, from: string, to: string) {
  return tx
    .select({ inv: invoices, clientName: contacts.name, clientTaxId: contacts.taxId })
    .from(invoices)
    .leftJoin(contacts, eq(contacts.id, invoices.clientId))
    .where(and(isNotNull(invoices.fullNumber), gte(invoices.issueDate, from), lte(invoices.issueDate, to)))
    .orderBy(asc(invoices.issueDate), asc(invoices.fullNumber));
}

export async function purchasesBook(tx: Tx, from: string, to: string) {
  return tx
    .select({ p: purchases, supplierName: contacts.name, supplierTaxId: contacts.taxId })
    .from(purchases)
    .leftJoin(contacts, eq(contacts.id, purchases.supplierId))
    .where(and(gte(purchases.issueDate, from), lte(purchases.issueDate, to)))
    .orderBy(asc(purchases.issueDate));
}
