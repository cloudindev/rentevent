import "server-only";
import { and, asc, contacts, desc, eq, inArray, isNotNull, isNull, itemUnits, items, or, movements, orderLines, orders, pickListLines, pickLists, projects, repairs, sql, type Tx } from "@rentevent/db";
import { syncReservations } from "@rentevent/db/services";
import { UserError } from "../action";
import { audit } from "../audit";
import type { AppContext } from "../context";
import { aggregateMaterial, compareLocation, lineStatus, listStatus, outstandingReturn, type PickKind } from "./logic";
import { detachStrays, logUnitEvents } from "./tracking";

type Ctx = Pick<AppContext, "user">;

const numericLines = (ls: (typeof pickListLines.$inferSelect)[]) => ls.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity), returned: Number(l.returned), damaged: Number(l.damaged), lost: Number(l.lost) }));

/** The list to work on for an order: the open one, else the latest (closed) one. */
export async function currentPickList(tx: Tx, orderId: string, kind: PickKind): Promise<{ id: string; status: string } | null> {
  const lists = await tx.select({ id: pickLists.id, status: pickLists.status }).from(pickLists).where(and(eq(pickLists.orderId, orderId), eq(pickLists.kind, kind))).orderBy(desc(pickLists.createdAt));
  return (kind === "retorno" ? lists.find((l) => l.status !== "devuelto") : undefined) ?? lists[0] ?? null;
}

/**
 * The existing list createPickList should return, or null to create one. A closed
 * return whose order is still on site with material missing gets a follow-up list
 * for what is still out, so the rest can be received later.
 */
async function reusableList(tx: Tx, orderId: string, kind: PickKind): Promise<string | null> {
  const cur = await currentPickList(tx, orderId, kind);
  if (!cur || kind === "salida" || cur.status !== "devuelto") return cur?.id ?? null;
  const [order] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId));
  if (order?.status !== "en_curso") return cur.id;
  const left = outstandingReturn(numericLines(await tx.select().from(pickListLines).where(eq(pickListLines.pickListId, cur.id))));
  return left.length ? null : cur.id;
}

/**
 * Creates (or returns the existing) pick list of an order: one per order + kind,
 * plus follow-up return lists for material still missing after a partial return.
 */
export async function createPickList(tx: Tx, ctx: Ctx | null, orderId: string, kind: PickKind): Promise<string> {
  const existing = await reusableList(tx, orderId, kind);
  if (existing) return existing;
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!order) throw new UserError("Pedido no encontrado");
  // a concurrent request may have created it while we waited for the lock
  const again = await reusableList(tx, orderId, kind);
  if (again) return again;
  // follow-up of a partial return: only what the previous return left out
  const previous = kind === "retorno" ? await currentPickList(tx, orderId, "retorno") : null;
  const rows = previous ? [] : await tx.select({ itemId: orderLines.itemId, quantity: orderLines.quantity, kind: orderLines.kind }).from(orderLines).where(eq(orderLines.orderId, orderId));
  const material = previous ? outstandingReturn(numericLines(await tx.select().from(pickListLines).where(eq(pickListLines.pickListId, previous.id)))) : aggregateMaterial(rows);
  if (material.length === 0) throw new UserError(previous ? "No queda material pendiente de volver." : "El pedido no tiene material para preparar.");
  const its = await tx.select({ id: items.id, location: items.location }).from(items).where(inArray(items.id, material.map((m) => m.itemId)));
  const loc = new Map(its.map((i) => [i.id, i.location]));
  const sorted = [...material].sort((a, b) => compareLocation(loc.get(a.itemId), loc.get(b.itemId)));
  // a return list starts from what actually left (loaded quantities), when known
  let qty = new Map(sorted.map((m) => [m.itemId, m.quantity]));
  if (kind === "retorno" && !previous) {
    const [out] = await tx.select().from(pickLists).where(and(eq(pickLists.orderId, orderId), eq(pickLists.kind, "salida")));
    if (out) {
      const outLines = await tx.select().from(pickListLines).where(eq(pickListLines.pickListId, out.id));
      const loaded = outLines.filter((l) => Number(l.loaded) > 0);
      if (loaded.length) qty = new Map(loaded.map((l) => [l.itemId, Number(l.loaded)]));
    }
  }
  const dueAt = kind === "salida" ? order.periodStart : order.periodEnd;
  const [list] = await tx
    .insert(pickLists)
    .values({ orderId, kind, status: kind === "salida" ? "por_preparar" : "por_volver", dueAt })
    .returning({ id: pickLists.id });
  const values = sorted
    .filter((m) => (qty.get(m.itemId) ?? 0) > 0)
    .map((m) => ({ pickListId: list!.id, itemId: m.itemId, location: loc.get(m.itemId) ?? null, quantity: qty.get(m.itemId)!, status: kind === "salida" ? "por_preparar" : "por_volver" }));
  if (values.length) await tx.insert(pickListLines).values(values);
  await audit(tx, ctx, "pick_list", list!.id, "crear", { pedido: order.number, tipo: kind, ...(previous ? { pendienteDe: previous.id } : {}) });
  return list!.id;
}

export async function loadPickList(tx: Tx, id: string) {
  const [list] = await tx.select().from(pickLists).where(eq(pickLists.id, id));
  if (!list) return null;
  const [order] = await tx.select().from(orders).where(eq(orders.id, list.orderId));
  const [project] = order ? await tx.select().from(projects).where(eq(projects.id, order.projectId)) : [undefined];
  const [client] = order?.clientId ? await tx.select({ name: contacts.name }).from(contacts).where(eq(contacts.id, order.clientId)) : [undefined];
  const lines = await tx
    .select({
      id: pickListLines.id,
      itemId: pickListLines.itemId,
      name: items.name,
      sku: items.sku,
      unit: items.unit,
      kind: items.kind,
      role: items.role,
      category: items.category,
      location: pickListLines.location,
      quantity: pickListLines.quantity,
      prepared: pickListLines.prepared,
      loaded: pickListLines.loaded,
      returned: pickListLines.returned,
      damaged: pickListLines.damaged,
      lost: pickListLines.lost,
      status: pickListLines.status,
      scannedUnits: pickListLines.scannedUnits,
    })
    .from(pickListLines)
    .innerJoin(items, eq(items.id, pickListLines.itemId))
    .where(eq(pickListLines.pickListId, id))
    .orderBy(asc(pickListLines.location), asc(items.name));
  return {
    list,
    order: order ?? null,
    projectName: project?.name ?? null,
    clientName: client?.name ?? null,
    lines: lines.map((l) => ({ ...l, quantity: Number(l.quantity), prepared: Number(l.prepared), loaded: Number(l.loaded), returned: Number(l.returned), damaged: Number(l.damaged), lost: Number(l.lost) })),
  };
}

/** Recomputes and stores line and list statuses (unless the list is already closed). */
export async function refreshStatuses(tx: Tx, listId: string, now = new Date()) {
  const [list] = await tx.select().from(pickLists).where(eq(pickLists.id, listId));
  if (!list) return;
  const kind = list.kind as PickKind;
  const closed = list.status === "en_obra" || (kind === "retorno" && list.status === "devuelto");
  const lines = await tx.select().from(pickListLines).where(eq(pickListLines.pickListId, listId));
  const counts = lines.map((l) => ({ id: l.id, quantity: Number(l.quantity), prepared: Number(l.prepared), loaded: Number(l.loaded), returned: Number(l.returned), damaged: Number(l.damaged), lost: Number(l.lost) }));
  const overdue = Boolean(list.dueAt && list.dueAt < now);
  for (const c of counts) {
    const st = closed && kind === "salida" ? "en_obra" : lineStatus(c, kind, overdue);
    await tx.update(pickListLines).set({ status: st }).where(eq(pickListLines.id, c.id));
  }
  const status = listStatus(counts, kind, { dueAt: list.dueAt, now, closed });
  if (status !== list.status) await tx.update(pickLists).set({ status }).where(eq(pickLists.id, listId));
  return status;
}

/** Loading finished: stock leaves the warehouse and the order is on site. */
export async function markLoaded(tx: Tx, ctx: Ctx, listId: string) {
  const data = await loadPickList(tx, listId);
  if (!data || data.list.kind !== "salida") throw new UserError("Lista de salida no encontrada");
  if (data.list.status === "en_obra") throw new UserError("Esta carga ya está registrada.");
  const loaded = data.lines.filter((l) => l.loaded > 0 || l.prepared > 0);
  if (loaded.length === 0) throw new UserError("No hay nada preparado ni cargado.");
  const unitIds: string[] = [];
  for (const l of data.lines) {
    const q = l.loaded > 0 ? l.loaded : l.prepared;
    if (l.loaded < q) await tx.update(pickListLines).set({ loaded: q }).where(eq(pickListLines.id, l.id));
    if (q > 0) await tx.insert(movements).values({ itemId: l.itemId, orderId: data.list.orderId, kind: "salida", quantity: -q, userId: ctx.user.id, note: `Carga pedido ${data.order?.number ?? ""}` });
    if (l.scannedUnits.length) {
      const out = await tx.select({ id: itemUnits.id }).from(itemUnits).where(and(eq(itemUnits.itemId, l.itemId), inArray(itemUnits.serial, l.scannedUnits)));
      unitIds.push(...out.map((u) => u.id));
    }
  }
  // serial units and the cases/sets they travel in leave with this order
  unitIds.push(...data.list.scannedContainers);
  if (unitIds.length) {
    await tx.update(itemUnits).set({ status: "en_obra", currentOrderId: data.list.orderId, lastSeenAt: new Date() }).where(inArray(itemUnits.id, unitIds));
    await logUnitEvents(tx, ctx, unitIds, "salida", { orderId: data.list.orderId, note: `Carga pedido ${data.order?.number ?? ""}` });
    await detachStrays(tx, ctx, unitIds);
  }
  await tx.update(pickLists).set({ status: "en_obra" }).where(eq(pickLists.id, listId));
  await tx.update(pickListLines).set({ status: "en_obra" }).where(eq(pickListLines.pickListId, listId));
  if (data.order && (data.order.status === "confirmado" || data.order.status === "opcion")) {
    await tx.update(orders).set({ status: "en_curso" }).where(eq(orders.id, data.order.id));
    await syncReservations(tx, data.order.id);
  }
  const short = data.lines.filter((l) => (l.loaded > 0 ? l.loaded : l.prepared) < l.quantity);
  await audit(tx, ctx, "pick_list", listId, "estado", { cargado: true, incompletas: short.length });
  return { incomplete: short.length };
}

export type ReturnInput = { lineId: string; returned: number; damaged: number; lost: number; dirty: boolean; note?: string | null };

/**
 * Closes a return: movements per outcome, damaged → repair (reduces availability
 * through items.stockRepair), dirty fabrics → cleaning queue, lost → stock down.
 */
export async function closeReturn(tx: Tx, ctx: Ctx, listId: string, input: ReturnInput[], missingAsLost: boolean) {
  const data = await loadPickList(tx, listId);
  if (!data || data.list.kind !== "retorno") throw new UserError("Lista de retorno no encontrada");
  if (data.list.status === "devuelto") throw new UserError("Este retorno ya está cerrado.");
  const orderNo = data.order?.number ?? "";
  let repairsCreated = 0;
  // serials that left on the outgoing list (for units loaded before per-order tracking existed)
  const [outList] = await tx.select({ id: pickLists.id }).from(pickLists).where(and(eq(pickLists.orderId, data.list.orderId), eq(pickLists.kind, "salida")));
  const outLines = outList ? await tx.select({ itemId: pickListLines.itemId, scannedUnits: pickListLines.scannedUnits }).from(pickListLines).where(eq(pickListLines.pickListId, outList.id)) : [];
  const outSerials = new Map(outLines.map((l) => [l.itemId, l.scannedUnits]));
  const settled: string[] = [];
  let pending = false;
  for (const l of data.lines) {
    const i = input.find((x) => x.lineId === l.id) ?? { lineId: l.id, returned: l.returned, damaged: l.damaged, lost: l.lost, dirty: false };
    const returned = Math.max(0, Math.min(i.returned, l.quantity));
    const damaged = Math.max(0, Math.min(i.damaged, l.quantity - returned));
    let lost = Math.max(0, Math.min(i.lost, l.quantity - returned - damaged));
    const missing = Math.round((l.quantity - returned - damaged - lost) * 100) / 100;
    if (missingAsLost) lost += missing;
    else if (missing > 0) pending = true;
    await tx.update(pickListLines).set({ returned, damaged, lost, status: "devuelto" }).where(eq(pickListLines.id, l.id));
    if (returned > 0) await tx.insert(movements).values({ itemId: l.itemId, orderId: data.list.orderId, kind: "retorno", quantity: returned, userId: ctx.user.id, note: `Retorno pedido ${orderNo}` });
    const dirty = i.dirty && returned > 0;
    const units = await settleUnits(tx, ctx, data.list.orderId, orderNo, l, { returned, damaged, lost }, outSerials.get(l.itemId) ?? [], dirty);
    settled.push(...units.all);
    if (damaged > 0) {
      await tx.insert(movements).values({ itemId: l.itemId, orderId: data.list.orderId, kind: "dano", quantity: damaged, userId: ctx.user.id, note: i.note ?? `Dañado en pedido ${orderNo}` });
      // one repair per damaged serial unit (closing it frees that unit), the rest as one bulk repair
      const reason = i.note || `Daño en el retorno del pedido ${orderNo}`;
      const perUnit = units.damaged.map((unitId) => ({ itemId: l.itemId, unitId, orderId: data.list.orderId, kind: "reparacion", quantity: 1, status: "pendiente", reason }));
      const bulk = damaged - perUnit.length;
      await tx.insert(repairs).values([...perUnit, ...(bulk > 0 ? [{ itemId: l.itemId, orderId: data.list.orderId, kind: "reparacion", quantity: bulk, status: "pendiente", reason }] : [])]);
      await tx.update(items).set({ stockRepair: sql`${items.stockRepair} + ${damaged}` }).where(eq(items.id, l.itemId));
      repairsCreated++;
    }
    if (dirty) {
      // as with damage: one cleaning per serial unit (finishing it frees that unit), the rest as one bulk job
      const reason = `Lona sucia tras el pedido ${orderNo}`;
      const perUnit = units.cleaning.map((unitId) => ({ itemId: l.itemId, unitId, orderId: data.list.orderId, kind: "limpieza", quantity: 1, status: "pendiente", reason }));
      const bulk = returned - perUnit.length;
      await tx.insert(repairs).values([...perUnit, ...(bulk > 0 ? [{ itemId: l.itemId, orderId: data.list.orderId, kind: "limpieza", quantity: bulk, status: "pendiente", reason }] : [])]);
      await tx.update(items).set({ stockRepair: sql`${items.stockRepair} + ${returned}` }).where(eq(items.id, l.itemId));
      await tx.insert(movements).values({ itemId: l.itemId, orderId: data.list.orderId, kind: "reparacion_alta", quantity: returned, userId: ctx.user.id, note: "A limpieza" });
      repairsCreated++;
    }
    if (lost > 0) {
      await tx.insert(movements).values({ itemId: l.itemId, orderId: data.list.orderId, kind: "perdida", quantity: -lost, userId: ctx.user.id, note: `Perdido en pedido ${orderNo}` });
      await tx.update(items).set({ stockTotal: sql`greatest(0, ${items.stockTotal} - ${lost})` }).where(eq(items.id, l.itemId));
    }
  }
  // cases/sets: scanned back → in the warehouse; with no scanning at all, the counts decide
  const outContainers = await tx
    .select({ id: itemUnits.id })
    .from(itemUnits)
    .innerJoin(items, eq(items.id, itemUnits.itemId))
    .where(and(eq(itemUnits.currentOrderId, data.list.orderId), eq(itemUnits.status, "en_obra"), isNotNull(items.container)));
  const noScans = data.list.scannedContainers.length === 0 && data.lines.every((l) => l.scannedUnits.length === 0);
  const backContainers = outContainers.map((c) => c.id).filter((id) => noScans || data.list.scannedContainers.includes(id));
  if (backContainers.length) {
    await tx.update(itemUnits).set({ status: "disponible", currentOrderId: null, lastSeenAt: new Date() }).where(inArray(itemUnits.id, backContainers));
    await logUnitEvents(tx, ctx, backContainers, "retorno", { orderId: data.list.orderId, note: `Retorno pedido ${orderNo}` });
  }
  // a unit that came back without its case (or the other way round) is taken out of it
  const stillOut = await tx.select({ id: itemUnits.id }).from(itemUnits).where(and(eq(itemUnits.currentOrderId, data.list.orderId), isNotNull(itemUnits.parentUnitId)));
  await detachStrays(tx, ctx, [...settled, ...backContainers, ...stillOut.map((u) => u.id)]);
  await tx.update(pickLists).set({ status: "devuelto" }).where(eq(pickLists.id, listId));
  if (data.order && !pending) {
    await tx.update(orders).set({ status: "devuelto" }).where(eq(orders.id, data.order.id));
    await syncReservations(tx, data.order.id);
  }
  await audit(tx, ctx, "pick_list", listId, "estado", { retornoCerrado: true, reparaciones: repairsCreated, pendiente: pending });
  return { repairsCreated, orderReturned: !pending };
}

/**
 * Per-serial settlement of one return line. Scanned serials are back; when the
 * line was counted by hand, that many of the order's units are. Of the rest,
 * `lost` become lost and `damaged` go to repair; anything left stays out on the order.
 */
async function settleUnits(
  tx: Tx,
  ctx: Ctx,
  orderId: string,
  orderNo: string,
  line: { itemId: string; scannedUnits: string[] },
  counts: { returned: number; damaged: number; lost: number },
  outSerials: string[],
  dirty = false,
) {
  const mine = await tx
    .select({ id: itemUnits.id, serial: itemUnits.serial })
    .from(itemUnits)
    .where(
      and(
        eq(itemUnits.itemId, line.itemId),
        eq(itemUnits.status, "en_obra"),
        or(eq(itemUnits.currentOrderId, orderId), outSerials.length ? and(isNull(itemUnits.currentOrderId), inArray(itemUnits.serial, outSerials)) : undefined),
      ),
    )
    .orderBy(asc(itemUnits.serial));
  if (!mine.length) return { all: [] as string[], damaged: [] as string[], cleaning: [] as string[] };
  const back = line.scannedUnits.length ? mine.filter((u) => line.scannedUnits.includes(u.serial)) : mine.slice(0, counts.returned);
  const rest = mine.filter((u) => !back.includes(u));
  const lostU = rest.slice(0, counts.lost);
  const damagedU = rest.slice(counts.lost, counts.lost + counts.damaged);
  // dirty fabrics come back but go to the cleaning queue, not to the shelf
  const cleanU = dirty ? back.slice(0, counts.returned) : [];
  const freeU = back.filter((u) => !cleanU.includes(u));
  const now = new Date();
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
  if (back.length) await logUnitEvents(tx, ctx, ids(back), "retorno", { orderId, note: `Retorno pedido ${orderNo}` });
  if (freeU.length) await tx.update(itemUnits).set({ status: "disponible", currentOrderId: null, lastSeenAt: now }).where(inArray(itemUnits.id, ids(freeU)));
  if (cleanU.length) {
    await tx.update(itemUnits).set({ status: "limpieza", currentOrderId: null, lastSeenAt: now }).where(inArray(itemUnits.id, ids(cleanU)));
    await logUnitEvents(tx, ctx, ids(cleanU), "limpieza", { orderId, note: `Sucia tras el pedido ${orderNo}` });
  }
  if (damagedU.length) {
    await tx.update(itemUnits).set({ status: "reparacion", currentOrderId: null, lastSeenAt: now }).where(inArray(itemUnits.id, ids(damagedU)));
    await logUnitEvents(tx, ctx, ids(damagedU), "danado", { orderId, note: `Dañada en el pedido ${orderNo}` });
  }
  if (lostU.length) {
    // keeps currentOrderId: the order is where it was last seen
    await tx.update(itemUnits).set({ status: "perdida" }).where(inArray(itemUnits.id, ids(lostU)));
    await logUnitEvents(tx, ctx, ids(lostU), "perdido", { orderId, note: `No volvió del pedido ${orderNo}` });
  }
  return { all: mine.map((u) => u.id), damaged: ids(damagedU), cleaning: ids(cleanU) };
}
