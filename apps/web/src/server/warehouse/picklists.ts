import "server-only";
import { and, asc, contacts, eq, inArray, itemUnits, items, movements, orderLines, orders, pickListLines, pickLists, projects, repairs, sql, type Tx } from "@rentevent/db";
import { syncReservations } from "@rentevent/db/services";
import { UserError } from "../action";
import { audit } from "../audit";
import type { AppContext } from "../context";
import { aggregateMaterial, compareLocation, lineStatus, listStatus, type PickKind } from "./logic";

type Ctx = Pick<AppContext, "user">;

/** Creates (or returns the existing) pick list of an order. Idempotent per order + kind. */
export async function createPickList(tx: Tx, ctx: Ctx | null, orderId: string, kind: PickKind): Promise<string> {
  const [existing] = await tx.select({ id: pickLists.id }).from(pickLists).where(and(eq(pickLists.orderId, orderId), eq(pickLists.kind, kind)));
  if (existing) return existing.id;
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!order) throw new UserError("Pedido no encontrado");
  // a concurrent request may have created it while we waited for the lock
  const [again] = await tx.select({ id: pickLists.id }).from(pickLists).where(and(eq(pickLists.orderId, orderId), eq(pickLists.kind, kind)));
  if (again) return again.id;
  const rows = await tx.select({ itemId: orderLines.itemId, quantity: orderLines.quantity, kind: orderLines.kind }).from(orderLines).where(eq(orderLines.orderId, orderId));
  const material = aggregateMaterial(rows);
  if (material.length === 0) throw new UserError("El pedido no tiene material para preparar.");
  const its = await tx.select({ id: items.id, location: items.location }).from(items).where(inArray(items.id, material.map((m) => m.itemId)));
  const loc = new Map(its.map((i) => [i.id, i.location]));
  const sorted = [...material].sort((a, b) => compareLocation(loc.get(a.itemId), loc.get(b.itemId)));
  // a return list starts from what actually left (loaded quantities), when known
  let qty = new Map(sorted.map((m) => [m.itemId, m.quantity]));
  if (kind === "retorno") {
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
  await audit(tx, ctx, "pick_list", list!.id, "crear", { pedido: order.number, tipo: kind });
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
  for (const l of data.lines) {
    const q = l.loaded > 0 ? l.loaded : l.prepared;
    if (l.loaded < q) await tx.update(pickListLines).set({ loaded: q }).where(eq(pickListLines.id, l.id));
    if (q > 0) await tx.insert(movements).values({ itemId: l.itemId, orderId: data.list.orderId, kind: "salida", quantity: -q, userId: ctx.user.id, note: `Carga pedido ${data.order?.number ?? ""}` });
    if (l.scannedUnits.length) {
      await tx.update(itemUnits).set({ status: "en_obra" }).where(and(eq(itemUnits.itemId, l.itemId), inArray(itemUnits.serial, l.scannedUnits)));
    }
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
  for (const l of data.lines) {
    const i = input.find((x) => x.lineId === l.id) ?? { lineId: l.id, returned: l.returned, damaged: l.damaged, lost: l.lost, dirty: false };
    const returned = Math.max(0, Math.min(i.returned, l.quantity));
    const damaged = Math.max(0, Math.min(i.damaged, l.quantity - returned));
    let lost = Math.max(0, Math.min(i.lost, l.quantity - returned - damaged));
    const missing = l.quantity - returned - damaged - lost;
    if (missingAsLost) lost += missing;
    await tx.update(pickListLines).set({ returned, damaged, lost, status: "devuelto" }).where(eq(pickListLines.id, l.id));
    if (returned > 0) await tx.insert(movements).values({ itemId: l.itemId, orderId: data.list.orderId, kind: "retorno", quantity: returned, userId: ctx.user.id, note: `Retorno pedido ${orderNo}` });
    if (damaged > 0) {
      await tx.insert(movements).values({ itemId: l.itemId, orderId: data.list.orderId, kind: "dano", quantity: damaged, userId: ctx.user.id, note: i.note ?? `Dañado en pedido ${orderNo}` });
      await tx.insert(repairs).values({ itemId: l.itemId, orderId: data.list.orderId, kind: "reparacion", quantity: damaged, status: "pendiente", reason: i.note || `Daño en el retorno del pedido ${orderNo}` });
      await tx.update(items).set({ stockRepair: sql`${items.stockRepair} + ${damaged}` }).where(eq(items.id, l.itemId));
      repairsCreated++;
    }
    if (i.dirty && returned > 0) {
      await tx.insert(repairs).values({ itemId: l.itemId, orderId: data.list.orderId, kind: "limpieza", quantity: returned, status: "pendiente", reason: `Lona sucia tras el pedido ${orderNo}` });
      await tx.update(items).set({ stockRepair: sql`${items.stockRepair} + ${returned}` }).where(eq(items.id, l.itemId));
      await tx.insert(movements).values({ itemId: l.itemId, orderId: data.list.orderId, kind: "reparacion_alta", quantity: returned, userId: ctx.user.id, note: "A limpieza" });
      repairsCreated++;
    }
    if (lost > 0) {
      await tx.insert(movements).values({ itemId: l.itemId, orderId: data.list.orderId, kind: "perdida", quantity: -lost, userId: ctx.user.id, note: `Perdido en pedido ${orderNo}` });
      await tx.update(items).set({ stockTotal: sql`greatest(0, ${items.stockTotal} - ${lost})` }).where(eq(items.id, l.itemId));
    }
    if (l.scannedUnits.length || returned > 0) {
      await tx.update(itemUnits).set({ status: "disponible" }).where(and(eq(itemUnits.itemId, l.itemId), eq(itemUnits.status, "en_obra")));
    }
  }
  const pending = data.lines.some((l) => {
    const i = input.find((x) => x.lineId === l.id);
    const acc = (i?.returned ?? 0) + (i?.damaged ?? 0) + (i?.lost ?? 0);
    return !missingAsLost && acc < l.quantity;
  });
  await tx.update(pickLists).set({ status: "devuelto" }).where(eq(pickLists.id, listId));
  if (data.order && !pending) {
    await tx.update(orders).set({ status: "devuelto" }).where(eq(orders.id, data.order.id));
    await syncReservations(tx, data.order.id);
  }
  await audit(tx, ctx, "pick_list", listId, "estado", { retornoCerrado: true, reparaciones: repairsCreated, pendiente: pending });
  return { repairsCreated, orderReturned: !pending };
}
