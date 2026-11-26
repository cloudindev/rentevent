import "server-only";
import { addDays, parseDayKey, zonedTime } from "@rentevent/core";
import {
  and,
  assignments,
  contacts,
  eq,
  gte,
  inArray,
  invoices,
  items,
  lt,
  ne,
  orderLines,
  orders,
  projects,
  purchases,
  quotes,
  reservations,
  shifts,
  structureFamilies,
  subrentals,
  timeEntries,
  workers,
  desc,
  type Tx,
} from "@rentevent/db";

export type Range = { from: string; to: string };

const startOf = (k: string) => {
  const [y, m, d] = parseDayKey(k);
  return new Date(zonedTime(y, m, d));
};
const H = 3_600_000;
const DAY = 86_400_000;

/** YYYY-MM keys covering the range. */
export function monthsIn(r: Range): string[] {
  const out: string[] = [];
  let [y, m] = parseDayKey(r.from);
  const [ty, tm] = parseDayKey(r.to);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (out.length > 36) break;
  }
  return out;
}
const monthStart = (mk: string) => startOf(`${mk}-01`);
const monthEnd = (mk: string) => {
  const [y, m] = mk.split("-").map(Number) as [number, number];
  return startOf(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`);
};

/** Average truss utilisation per family and month (confirmed + options). */
export async function familyOccupancy(tx: Tx, r: Range) {
  const months = monthsIn(r);
  const fams = await tx.select().from(structureFamilies).where(eq(structureFamilies.active, true));
  const trussIds = [...new Set(fams.map((f) => f.trussItemId).filter(Boolean) as string[])];
  if (!trussIds.length) return { months, rows: [] as { family: string; truss: string; values: number[] }[] };
  const stock = await tx.select({ id: items.id, sku: items.sku, total: items.stockTotal, repair: items.stockRepair }).from(items).where(inArray(items.id, trussIds));
  const res = await tx
    .select()
    .from(reservations)
    .where(and(inArray(reservations.itemId, trussIds), inArray(reservations.status, ["confirmado", "opcion"]), lt(reservations.startsAt, monthEnd(months[months.length - 1]!)), gte(reservations.endsAt, monthStart(months[0]!))));
  const util = new Map<string, number[]>();
  for (const id of trussIds) {
    const s = stock.find((x) => x.id === id);
    const usable = Math.max(1, Number(s?.total ?? 0) - Number(s?.repair ?? 0));
    util.set(
      id,
      months.map((mk) => {
        const a = monthStart(mk).getTime();
        const b = monthEnd(mk).getTime();
        const unitDays = res.filter((x) => x.itemId === id).reduce((sum, x) => sum + (Math.max(0, Math.min(b, x.endsAt.getTime()) - Math.max(a, x.startsAt.getTime())) / DAY) * Number(x.quantity), 0);
        return Math.round((unitDays / (((b - a) / DAY) * usable)) * 1000) / 10;
      }),
    );
  }
  return {
    months,
    rows: fams
      .filter((f) => f.trussItemId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((f) => ({ family: f.name, truss: stock.find((s) => s.id === f.trussItemId)?.sku ?? "", values: util.get(f.trussItemId!) ?? [] })),
  };
}

/** Invoiced base per month (issued, paid or overdue). */
export async function revenueByMonth(tx: Tx, r: Range) {
  const months = monthsIn(r);
  const rows = await tx
    .select({ date: invoices.issueDate, base: invoices.subtotal, total: invoices.total, paid: invoices.paid })
    .from(invoices)
    .where(and(gte(invoices.issueDate, `${months[0]}-01`), lt(invoices.issueDate, monthEnd(months[months.length - 1]!).toISOString().slice(0, 10)), inArray(invoices.status, ["emitida", "cobrada", "vencida"])));
  return months.map((mk) => {
    const inMonth = rows.filter((x) => x.date?.startsWith(mk));
    return { month: mk, base: round(inMonth.reduce((s, x) => s + Number(x.base), 0)), cobrado: round(inMonth.reduce((s, x) => s + Number(x.paid), 0)), facturas: inMonth.length };
  });
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Revenue vs estimated cost per project with activity in the range. */
export async function marginByProject(tx: Tx, r: Range) {
  const a = startOf(r.from);
  const b = startOf(addDays(r.to, 1));
  const ps = await tx
    .select({ id: projects.id, name: projects.name, number: projects.number, status: projects.status, client: contacts.name })
    .from(projects)
    .leftJoin(contacts, eq(contacts.id, projects.clientId))
    .where(and(lt(projects.startsAt, b), gte(projects.endsAt, a)));
  if (!ps.length) return [];
  const ids = ps.map((p) => p.id);
  const [os, invs, subs, purs, lines, entries, qs] = await Promise.all([
    tx.select({ id: orders.id, projectId: orders.projectId, status: orders.status }).from(orders).where(inArray(orders.projectId, ids)),
    tx.select({ projectId: invoices.projectId, orderId: invoices.orderId, base: invoices.subtotal, status: invoices.status }).from(invoices).where(inArray(invoices.status, ["emitida", "cobrada", "vencida"])),
    tx.select({ projectId: subrentals.projectId, cost: subrentals.cost, id: subrentals.id }).from(subrentals).where(inArray(subrentals.projectId, ids)),
    tx.select({ projectId: purchases.projectId, base: purchases.base, subrentalId: purchases.subrentalId }).from(purchases).where(inArray(purchases.projectId, ids)),
    tx.select({ orderId: orderLines.orderId, qty: orderLines.quantity, cost: orderLines.unitCost, fromBom: orderLines.fromBom }).from(orderLines).innerJoin(orders, eq(orders.id, orderLines.orderId)).where(inArray(orders.projectId, ids)),
    tx
      .select({ projectId: shifts.projectId, clockIn: timeEntries.clockIn, clockOut: timeEntries.clockOut, breakMin: timeEntries.breakMinutes, cph: workers.costPerHour })
      .from(timeEntries)
      .innerJoin(shifts, eq(shifts.id, timeEntries.shiftId))
      .innerJoin(workers, eq(workers.id, timeEntries.workerId))
      .where(inArray(shifts.projectId, ids)),
    tx.select({ orderId: quotes.orderId, total: quotes.total, version: quotes.version }).from(quotes).innerJoin(orders, eq(orders.id, quotes.orderId)).where(inArray(orders.projectId, ids)).orderBy(desc(quotes.version)),
  ]);
  return ps
    .map((p) => {
      const orderIds = os.filter((o) => o.projectId === p.id && o.status !== "cancelado").map((o) => o.id);
      const invoiced = invs.filter((i) => i.projectId === p.id || (i.orderId && orderIds.includes(i.orderId))).reduce((s, i) => s + Number(i.base), 0);
      const quoted = orderIds.reduce((s, oid) => {
        const q = qs.find((x) => x.orderId === oid);
        return s + (q ? Number(q.total) / 1.21 : 0);
      }, 0);
      const purchaseSubIds = new Set(purs.filter((x) => x.projectId === p.id && x.subrentalId).map((x) => x.subrentalId));
      const subCost = subs.filter((s) => s.projectId === p.id && !purchaseSubIds.has(s.id)).reduce((s, x) => s + Number(x.cost), 0);
      const purCost = purs.filter((x) => x.projectId === p.id).reduce((s, x) => s + Number(x.base), 0);
      const lineCost = lines.filter((l) => orderIds.includes(l.orderId) && !l.fromBom).reduce((s, l) => s + Number(l.qty) * Number(l.cost), 0);
      const crew = entries.filter((e) => e.projectId === p.id && e.clockOut).reduce((s, e) => s + (Math.max(0, e.clockOut!.getTime() - e.clockIn.getTime() - e.breakMin * 60000) / H) * Number(e.cph), 0);
      const revenue = invoiced || quoted;
      const cost = lineCost + subCost + purCost + crew;
      return {
        id: p.id,
        number: p.number,
        name: p.name,
        client: p.client ?? "",
        status: p.status,
        revenue: round(revenue),
        revenueSource: invoiced ? "facturado" : "presupuestado",
        cost: round(cost),
        margin: round(revenue - cost),
        marginPct: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : 0,
      };
    })
    .sort((x, y) => y.revenue - x.revenue);
}

/** Planned (assigned shifts) vs worked hours per worker. */
export async function crewHours(tx: Tx, r: Range) {
  const a = startOf(r.from);
  const b = startOf(addDays(r.to, 1));
  const [ws, planned, real] = await Promise.all([
    tx.select({ id: workers.id, name: workers.name, type: workers.type }).from(workers).where(eq(workers.active, true)),
    tx
      .select({ workerId: assignments.workerId, start: shifts.startsAt, end: shifts.endsAt })
      .from(assignments)
      .innerJoin(shifts, eq(shifts.id, assignments.shiftId))
      // rejected assignments aren't planned work (same rule as Fichajes)
      .where(and(gte(shifts.startsAt, a), lt(shifts.startsAt, b), ne(assignments.status, "rechazado"))),
    tx.select().from(timeEntries).where(and(gte(timeEntries.clockIn, a), lt(timeEntries.clockIn, b))),
  ]);
  return ws
    .map((w) => {
      const p = planned.filter((x) => x.workerId === w.id).reduce((s, x) => s + (x.end.getTime() - x.start.getTime()) / H, 0);
      const done = real.filter((x) => x.workerId === w.id && x.clockOut).reduce((s, x) => s + Math.max(0, x.clockOut!.getTime() - x.clockIn.getTime() - x.breakMinutes * 60000) / H, 0);
      return { id: w.id, name: w.name, type: w.type, planned: round(p), worked: round(done), diff: round(done - p) };
    })
    .filter((x) => x.planned > 0 || x.worked > 0)
    .sort((x, y) => y.planned - x.planned);
}

/** Top clients by invoiced base. */
export async function topClients(tx: Tx, r: Range, limit = 10) {
  const rows = await tx
    .select({ id: contacts.id, name: contacts.name, base: invoices.subtotal })
    .from(invoices)
    .innerJoin(contacts, eq(contacts.id, invoices.clientId))
    .where(and(gte(invoices.issueDate, r.from), lt(invoices.issueDate, addDays(r.to, 1)), inArray(invoices.status, ["emitida", "cobrada", "vencida"])));
  const map = new Map<string, { id: string; name: string; base: number; invoices: number }>();
  for (const x of rows) {
    const e = map.get(x.id) ?? { id: x.id, name: x.name, base: 0, invoices: 0 };
    e.base = round(e.base + Number(x.base));
    e.invoices++;
    map.set(x.id, e);
  }
  return [...map.values()].sort((a, b) => b.base - a.base).slice(0, limit);
}

export function toCsv(header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(";")).join("\n");
}
