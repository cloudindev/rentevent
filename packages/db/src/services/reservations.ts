/**
 * Reservation & availability services (server-side, transactional).
 *
 * The pure maths lives in @rentevent/core; this module loads the inputs from
 * PostgreSQL, keeps reservations in sync with order lines and confirms orders
 * under per-item row locks so two sales people can never confirm the same
 * trusses twice.
 */
import { and, eq, gt, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import {
  checkLines,
  computeAvailability,
  dailyBalance,
  type LineCheck,
  type ReservationInput,
  type ReservationStatus,
  type StockInput,
  type SubrentalInput,
} from "@rentevent/core";
import type { Tx } from "../client";
import { items, orderLines, orders, projects, reservations, subrentals, tenantSettings } from "../schema";

export class AvailabilityConflictError extends Error {
  constructor(public readonly shortages: LineCheck[]) {
    super(
      `No hay material suficiente: ${shortages.map((s) => `faltan ${s.shortage} de ${s.itemId}`).join(", ")}`,
    );
    this.name = "AvailabilityConflictError";
  }
}

/** Order status → reservation status (null = does not reserve). */
export function reservationStatusFor(orderStatus: string): ReservationStatus | null {
  switch (orderStatus) {
    case "consulta":
      return "consulta";
    case "opcion":
      return "opcion";
    case "confirmado":
    case "en_curso":
      return "confirmado";
    default:
      return null;
  }
}

export async function marginMinutes(tx: Tx): Promise<number> {
  const [s] = await tx.select({ m: tenantSettings.availabilityMarginMinutes }).from(tenantSettings);
  return s?.m ?? 60;
}

export type AvailabilityInputs = {
  stocks: Map<string, StockInput>;
  reservations: ReservationInput[];
  subrentals: SubrentalInput[];
};

/** Loads stock, overlapping reservations and incoming subrentals for the given items. */
export async function loadAvailabilityInputs(tx: Tx, itemIds: string[], range: { start: Date; end: Date }, marginMin = 0): Promise<AvailabilityInputs> {
  const ids = [...new Set(itemIds)];
  if (ids.length === 0) return { stocks: new Map(), reservations: [], subrentals: [] };
  const from = new Date(range.start.getTime() - marginMin * 60_000);
  const [stockRows, resRows, subRows] = await Promise.all([
    tx.select({ id: items.id, total: items.stockTotal, repair: items.stockRepair }).from(items).where(inArray(items.id, ids)),
    tx
      .select({
        id: reservations.id,
        itemId: reservations.itemId,
        quantity: reservations.quantity,
        start: reservations.startsAt,
        end: reservations.endsAt,
        status: reservations.status,
        expiresAt: reservations.expiresAt,
        projectId: reservations.projectId,
        orderId: reservations.orderId,
        projectName: projects.name,
        orderTitle: orders.title,
      })
      .from(reservations)
      .leftJoin(projects, eq(projects.id, reservations.projectId))
      .leftJoin(orders, eq(orders.id, reservations.orderId))
      .where(and(inArray(reservations.itemId, ids), lt(reservations.startsAt, range.end), gt(reservations.endsAt, from))),
    tx
      .select()
      .from(subrentals)
      .where(and(inArray(subrentals.itemId, ids), lt(subrentals.startsAt, range.end), gt(subrentals.endsAt, range.start), inArray(subrentals.status, ["confirmado", "recibido"]))),
  ]);
  return {
    stocks: new Map(stockRows.map((s) => [s.id, { itemId: s.id, total: Number(s.total), inRepair: Number(s.repair) }])),
    reservations: resRows.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      quantity: Number(r.quantity),
      start: r.start.getTime(),
      end: r.end.getTime(),
      status: r.status as ReservationStatus,
      expiresAt: r.expiresAt?.getTime() ?? null,
      // availability is per order ("pedido"): the order id identifies the occupant
      projectId: r.orderId ?? r.projectId ?? r.id,
      projectName: r.orderTitle ?? r.projectName ?? "Reserva manual",
    })),
    subrentals: subRows.map((s) => ({ id: s.id, itemId: s.itemId, quantity: Number(s.quantity), start: s.startsAt.getTime(), end: s.endsAt.getTime() })),
  };
}

/** Material lines an order needs (item lines incl. BOM sub-lines), summed by item. */
export async function orderMaterial(tx: Tx, orderId: string): Promise<{ itemId: string; quantity: number }[]> {
  const rows = await tx
    .select({ itemId: orderLines.itemId, quantity: orderLines.quantity, kind: orderLines.kind })
    .from(orderLines)
    .innerJoin(items, eq(items.id, orderLines.itemId))
    .where(and(eq(orderLines.orderId, orderId), isNotNull(orderLines.itemId), ne(items.kind, "servicio")));
  const sum = new Map<string, number>();
  for (const r of rows) {
    if (!r.itemId || r.kind === "suplemento") continue;
    sum.set(r.itemId, (sum.get(r.itemId) ?? 0) + Number(r.quantity));
  }
  return [...sum.entries()].map(([itemId, quantity]) => ({ itemId, quantity }));
}

export async function checkOrderAvailability(tx: Tx, orderId: string, lines?: { itemId: string; quantity: number }[], now = Date.now()) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new Error("Pedido no encontrado");
  const material = lines ?? (await orderMaterial(tx, orderId));
  const margin = await marginMinutes(tx);
  const range = { start: order.periodStart, end: order.periodEnd };
  const inputs = await loadAvailabilityInputs(tx, material.map((l) => l.itemId), range, margin);
  return checkLines(material, inputs.stocks, inputs.reservations, inputs.subrentals, { start: range.start.getTime(), end: range.end.getTime() }, { marginMinutes: margin, now, excludeProjectId: orderId });
}

/** Recreates the reservations of an order from its lines and status. */
export async function syncReservations(tx: Tx, orderId: string) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return;
  await tx.delete(reservations).where(eq(reservations.orderId, orderId));
  const status = reservationStatusFor(order.status);
  if (!status) return;
  const material = await orderMaterial(tx, orderId);
  if (material.length === 0) return;
  await tx.insert(reservations).values(
    material.map((m) => ({
      itemId: m.itemId,
      orderId,
      projectId: order.projectId,
      quantity: m.quantity,
      startsAt: order.periodStart,
      endsAt: order.periodEnd,
      status,
      expiresAt: status === "opcion" ? order.optionExpiresAt : null,
      source: "configuracion",
    })),
  );
}

/**
 * Changes an order to a reserving status. Locks every involved item row
 * (FOR UPDATE, ordered by id to avoid deadlocks), re-checks availability
 * excluding this order, and only then writes the reservations. A concurrent
 * confirmation of the same items waits for the lock and then sees ours.
 */
export async function reserveOrder(
  tx: Tx,
  orderId: string,
  status: "confirmado" | "opcion" | "consulta",
  opts: { userId?: string | null; optionExpiresAt?: Date | null; allowShortage?: boolean; now?: number } = {},
): Promise<{ checks: LineCheck[] }> {
  const material = await orderMaterial(tx, orderId);
  const ids = [...new Set(material.map((m) => m.itemId))].sort();
  if (ids.length) {
    await tx.execute(sql`select id from items where id in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)}) order by id for update`);
  }
  const checks = await checkOrderAvailability(tx, orderId, material, opts.now);
  const short = checks.filter((c) => c.shortage > 0);
  if (status !== "consulta" && short.length && !opts.allowShortage) throw new AvailabilityConflictError(short);
  await tx
    .update(orders)
    .set({
      status,
      optionExpiresAt: status === "opcion" ? opts.optionExpiresAt ?? null : null,
      confirmedAt: status === "confirmado" ? new Date() : null,
      confirmedBy: status === "confirmado" ? opts.userId ?? null : null,
    })
    .where(eq(orders.id, orderId));
  await syncReservations(tx, orderId);
  return { checks };
}

/** Options past their expiry date go back to "consulta" (no longer reserving). */
export async function expireOptions(tx: Tx, now = new Date()) {
  const expired = await tx
    .update(orders)
    .set({ status: "consulta", optionExpiresAt: null })
    .where(and(eq(orders.status, "opcion"), lt(orders.optionExpiresAt, now)))
    .returning({ id: orders.id, title: orders.title, number: orders.number });
  for (const o of expired) await syncReservations(tx, o.id);
  return expired;
}

export type TimelineRow = { key: string; label: string; kind: "proyecto" | "este" | "subalquiler"; status?: string; spans: { start: number; end: number; quantity: number }[] };

/** Data for the per-item timeline card on the order screen. */
export async function itemTimeline(
  tx: Tx,
  itemId: string,
  days: { day: string; start: number; end: number }[],
  thisOrderId: string | null,
  thisQuantity?: number,
  thisPeriod?: { start: number; end: number },
) {
  if (days.length === 0) return { rows: [] as TimelineRow[], cells: [], stock: { itemId, total: 0, inRepair: 0 } };
  const range = { start: new Date(days[0]!.start), end: new Date(days[days.length - 1]!.end) };
  const margin = await marginMinutes(tx);
  const inputs = await loadAvailabilityInputs(tx, [itemId], range, margin);
  const stock = inputs.stocks.get(itemId) ?? { itemId, total: 0, inRepair: 0 };
  let res = inputs.reservations;
  if (thisOrderId && thisQuantity !== undefined && thisPeriod) {
    // reflect unsaved edits of this order in the timeline
    res = res.filter((r) => r.projectId !== thisOrderId);
    if (thisQuantity > 0) res.push({ id: "this", itemId, quantity: thisQuantity, start: thisPeriod.start, end: thisPeriod.end, status: "confirmado", projectId: thisOrderId, projectName: "Este pedido" });
  }
  const rowsMap = new Map<string, TimelineRow>();
  for (const r of res) {
    const isThis = r.projectId === thisOrderId;
    const key = isThis ? "este" : r.projectId;
    const row = rowsMap.get(key) ?? { key, label: isThis ? "Este pedido" : r.projectName, kind: isThis ? ("este" as const) : ("proyecto" as const), status: r.status, spans: [] };
    row.spans.push({ start: r.start, end: r.end, quantity: r.quantity });
    rowsMap.set(key, row);
  }
  const subRow: TimelineRow = { key: "subalquiler", label: "Subalquiler", kind: "subalquiler", spans: inputs.subrentals.map((s) => ({ start: s.start, end: s.end, quantity: s.quantity })) };
  const cells = dailyBalance(stock, res, inputs.subrentals, days, { marginMinutes: margin, thisProjectId: thisOrderId });
  const rows = [...rowsMap.values()].filter((r) => r.kind !== "este").sort((a, b) => a.label.localeCompare(b.label));
  const mine = rowsMap.get("este");
  return { rows: [...rows, mine ?? { key: "este", label: "Este pedido", kind: "este" as const, spans: [] }, subRow], cells, stock };
}

/** Peak availability for several items in a range (used by reverse queries and the assistant). */
export async function availableMap(tx: Tx, itemIds: string[], range: { start: Date; end: Date }, excludeOrderId?: string | null, now = Date.now()) {
  const margin = await marginMinutes(tx);
  const inputs = await loadAvailabilityInputs(tx, itemIds, range, margin);
  const out = new Map<string, number>();
  for (const id of itemIds) {
    const stock = inputs.stocks.get(id) ?? { itemId: id, total: 0, inRepair: 0 };
    out.set(id, computeAvailability(stock, inputs.reservations, inputs.subrentals, { start: range.start.getTime(), end: range.end.getTime() }, { marginMinutes: margin, now, excludeProjectId: excludeOrderId ?? null }).available);
  }
  return out;
}

