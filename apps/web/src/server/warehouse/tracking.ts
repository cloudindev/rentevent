import "server-only";
import { and, asc, desc, eq, inArray, inspections, isNotNull, itemUnits, items, orders, repairs, unitContents, unitEvents, warehouses, type Tx } from "@rentevent/db";
import { UserError } from "../action";
import type { AppContext } from "../context";
import { expandContainer, normalizeCode, wouldCycle, type TreeUnit } from "./logic";

type Ctx = Pick<AppContext, "user"> | null;

export type UnitEventKind =
  | "alta"
  | "salida"
  | "retorno"
  | "danado"
  | "perdido"
  | "reparacion"
  | "limpieza"
  | "reparado"
  | "baja"
  | "revision"
  | "traslado"
  | "empaquetado"
  | "desempaquetado"
  | "contenido"
  | "estado";

/** Appends the same event to several units (e.g. a whole case leaving on an order). */
export async function logUnitEvents(tx: Tx, ctx: Ctx, unitIds: string[], kind: UnitEventKind, opts: { orderId?: string | null; note?: string | null } = {}) {
  const ids = [...new Set(unitIds)];
  if (!ids.length) return;
  await tx.insert(unitEvents).values(ids.map((unitId) => ({ unitId, kind, orderId: opts.orderId ?? null, note: opts.note ?? null, userId: ctx?.user.id ?? null, userName: ctx?.user.name ?? "Sistema" })));
}

/**
 * A unit that left or came back without the case/set it was packed in is
 * no longer in it: unpack it, so "where is it" stays true.
 */
export async function detachStrays(tx: Tx, ctx: Ctx, unitIds: string[]) {
  const ids = [...new Set(unitIds)];
  if (!ids.length) return 0;
  const rows = await tx
    .select({ id: itemUnits.id, status: itemUnits.status, orderId: itemUnits.currentOrderId, parentId: itemUnits.parentUnitId })
    .from(itemUnits)
    .where(and(inArray(itemUnits.id, ids), isNotNull(itemUnits.parentUnitId)));
  if (!rows.length) return 0;
  const parents = await tx
    .select({ id: itemUnits.id, serial: itemUnits.serial, status: itemUnits.status, orderId: itemUnits.currentOrderId })
    .from(itemUnits)
    .where(inArray(itemUnits.id, [...new Set(rows.map((r) => r.parentId!))]));
  let n = 0;
  for (const r of rows) {
    const p = parents.find((x) => x.id === r.parentId);
    if (!p || (p.status === r.status && p.orderId === r.orderId)) continue;
    await tx.update(itemUnits).set({ parentUnitId: null }).where(eq(itemUnits.id, r.id));
    await logUnitEvents(tx, ctx, [r.id], "desempaquetado", { note: `Viajó sin ${p.serial}` });
    await logUnitEvents(tx, ctx, [p.id], "contenido", { note: "Una unidad viajó por separado y se ha sacado" });
    n++;
  }
  return n;
}

/** Finds a unit by its QR code, a label URL or (case-insensitive) its serial number. */
export async function findUnitByCode(tx: Tx, raw: string) {
  const code = normalizeCode(raw);
  if (!code) return null;
  const sel = { unit: itemUnits, item: { id: items.id, name: items.name, sku: items.sku, container: items.container, location: items.location, warehouseId: items.warehouseId } };
  const [byQr] = await tx.select(sel).from(itemUnits).innerJoin(items, eq(items.id, itemUnits.itemId)).where(eq(itemUnits.qrCode, code));
  if (byQr) return byQr;
  const bySerial = await tx.select(sel).from(itemUnits).innerJoin(items, eq(items.id, itemUnits.itemId)).where(eq(itemUnits.serial, code.toUpperCase()));
  return bySerial.length === 1 ? bySerial[0]! : null;
}

/** All packed units and bulk contents of the tenant (small tables), for container expansion. */
async function packingIndex(tx: Tx) {
  const [packed, contents] = await Promise.all([
    tx.select({ id: itemUnits.id, itemId: itemUnits.itemId, serial: itemUnits.serial, parentUnitId: itemUnits.parentUnitId }).from(itemUnits).where(isNotNull(itemUnits.parentUnitId)),
    tx.select({ containerUnitId: unitContents.containerUnitId, itemId: unitContents.itemId, quantity: unitContents.quantity }).from(unitContents),
  ]);
  return { packed: packed as TreeUnit[], contents: contents.map((c) => ({ ...c, quantity: Number(c.quantity) })) };
}

/** Units (with status and order) and bulk contents inside a case or set, at any depth. */
export async function containerContents(tx: Tx, rootId: string) {
  const idx = await packingIndex(tx);
  const e = expandContainer(rootId, idx.packed, idx.contents);
  const full = e.units.length
    ? await tx
        .select({ id: itemUnits.id, itemId: itemUnits.itemId, serial: itemUnits.serial, status: itemUnits.status, currentOrderId: itemUnits.currentOrderId, parentUnitId: itemUnits.parentUnitId, container: items.container })
        .from(itemUnits)
        .innerJoin(items, eq(items.id, itemUnits.itemId))
        .where(inArray(itemUnits.id, e.units.map((u) => u.id)))
    : [];
  return { units: full, bulk: e.bulk };
}

async function descendantIds(tx: Tx, rootId: string) {
  const idx = await packingIndex(tx);
  return expandContainer(rootId, idx.packed, idx.contents).units.map((u) => u.id);
}

async function containerUnit(tx: Tx, id: string) {
  const [row] = await tx.select({ unit: itemUnits, container: items.container, name: items.name }).from(itemUnits).innerJoin(items, eq(items.id, itemUnits.itemId)).where(eq(itemUnits.id, id));
  if (!row) throw new UserError("Unidad no encontrada");
  if (!row.container) throw new UserError(`${row.name} no es una caja ni un conjunto. Márcalo como contenedor en la ficha del artículo.`);
  return row;
}

/** Packs a unit (found by code or serial) into a case or set. */
export async function packUnit(tx: Tx, ctx: Ctx, containerId: string, code: string) {
  const box = await containerUnit(tx, containerId);
  const hit = await findUnitByCode(tx, code);
  if (!hit) throw new UserError(`No hay ninguna unidad con el código ${normalizeCode(code)}.`);
  const child = hit.unit;
  if (child.id === containerId) throw new UserError("Una caja no puede ir dentro de sí misma.");
  if (child.parentUnitId === containerId) throw new UserError(`${child.serial} ya está en esta caja.`);
  const all = await tx.select({ id: itemUnits.id, parentUnitId: itemUnits.parentUnitId }).from(itemUnits).where(isNotNull(itemUnits.parentUnitId));
  if (wouldCycle(child.id, containerId, new Map(all.map((u) => [u.id, u.parentUnitId])))) throw new UserError(`${box.unit.serial} está dentro de ${child.serial}; no se pueden meter una en otra.`);
  if (child.status === "en_obra" || box.unit.status === "en_obra") {
    if (child.currentOrderId !== box.unit.currentOrderId) throw new UserError("No se puede empaquetar material que está fuera en otro evento.");
  }
  if (child.status === "baja" || child.status === "perdida") throw new UserError(`${child.serial} está dada de baja o perdida.`);
  const from = child.parentUnitId ? (await tx.select({ serial: itemUnits.serial }).from(itemUnits).where(eq(itemUnits.id, child.parentUnitId)))[0]?.serial : null;
  await tx.update(itemUnits).set({ parentUnitId: containerId, warehouseId: box.unit.warehouseId, location: box.unit.location }).where(eq(itemUnits.id, child.id));
  await logUnitEvents(tx, ctx, [child.id], "empaquetado", { note: `En ${box.name} ${box.unit.serial}${from ? ` (antes en ${from})` : ""}` });
  await logUnitEvents(tx, ctx, [containerId], "contenido", { note: `+ ${hit.item.name} ${child.serial}` });
  return { serial: child.serial, name: hit.item.name };
}

export async function unpackUnit(tx: Tx, ctx: Ctx, unitId: string) {
  const [u] = await tx.select().from(itemUnits).where(eq(itemUnits.id, unitId));
  if (!u?.parentUnitId) throw new UserError("La unidad no está en ninguna caja.");
  const [box] = await tx.select({ serial: itemUnits.serial }).from(itemUnits).where(eq(itemUnits.id, u.parentUnitId));
  await tx.update(itemUnits).set({ parentUnitId: null }).where(eq(itemUnits.id, unitId));
  await logUnitEvents(tx, ctx, [unitId], "desempaquetado", { note: `Sacada de ${box?.serial ?? "la caja"}` });
  await logUnitEvents(tx, ctx, [u.parentUnitId], "contenido", { note: `− ${u.serial}` });
  return { containerId: u.parentUnitId };
}

/** Sets (or removes, with 0) the bulk quantity of an item inside a case or set. */
export async function setBulkContent(tx: Tx, ctx: Ctx, containerId: string, itemId: string, quantity: number) {
  await containerUnit(tx, containerId);
  const [it] = await tx.select({ name: items.name, kind: items.kind }).from(items).where(eq(items.id, itemId));
  if (!it) throw new UserError("Artículo no encontrado");
  if (quantity <= 0) await tx.delete(unitContents).where(and(eq(unitContents.containerUnitId, containerId), eq(unitContents.itemId, itemId)));
  else
    await tx
      .insert(unitContents)
      .values({ containerUnitId: containerId, itemId, quantity })
      .onConflictDoUpdate({ target: [unitContents.tenantId, unitContents.containerUnitId, unitContents.itemId], set: { quantity } });
  await logUnitEvents(tx, ctx, [containerId], "contenido", { note: quantity > 0 ? `${it.name} × ${quantity}` : `− ${it.name}` });
}

/** Moves a unit (and everything packed inside it) to a warehouse shelf. */
export async function moveUnit(tx: Tx, ctx: Ctx, unitId: string, warehouseId: string | null, location: string | null) {
  const [u] = await tx.select().from(itemUnits).where(eq(itemUnits.id, unitId));
  if (!u) throw new UserError("Unidad no encontrada");
  if (u.parentUnitId) throw new UserError("Está dentro de una caja: mueve la caja o sácala primero.");
  if (u.status === "en_obra") throw new UserError("La unidad está fuera en un evento; se ubicará al volver.");
  const wh = warehouseId ? (await tx.select({ name: warehouses.name }).from(warehouses).where(eq(warehouses.id, warehouseId)))[0] : null;
  if (warehouseId && !wh) throw new UserError("Almacén no encontrado");
  const ids = [unitId, ...(await descendantIds(tx, unitId))];
  await tx.update(itemUnits).set({ warehouseId, location }).where(inArray(itemUnits.id, ids));
  await logUnitEvents(tx, ctx, ids, "traslado", { note: [wh?.name, location].filter(Boolean).join(" · ") || "Sin ubicación" });
}

/** Everything the unit page shows: where it is, what it holds, what happened to it. */
export async function unitDetail(tx: Tx, unitId: string) {
  const [row] = await tx
    .select({ unit: itemUnits, item: { id: items.id, name: items.name, sku: items.sku, category: items.category, container: items.container, location: items.location, warehouseId: items.warehouseId, inspectionIntervalDays: items.inspectionIntervalDays } })
    .from(itemUnits)
    .innerJoin(items, eq(items.id, itemUnits.itemId))
    .where(eq(itemUnits.id, unitId));
  if (!row) return null;
  const { unit } = row;
  const [parent, order, whs, children, bulk, events, reps, insps] = await Promise.all([
    unit.parentUnitId
      ? tx.select({ id: itemUnits.id, serial: itemUnits.serial, name: items.name }).from(itemUnits).innerJoin(items, eq(items.id, itemUnits.itemId)).where(eq(itemUnits.id, unit.parentUnitId))
      : Promise.resolve([]),
    unit.currentOrderId ? tx.select({ id: orders.id, number: orders.number, title: orders.title, periodEnd: orders.periodEnd }).from(orders).where(eq(orders.id, unit.currentOrderId)) : Promise.resolve([]),
    tx.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).orderBy(asc(warehouses.name)),
    tx
      .select({ id: itemUnits.id, serial: itemUnits.serial, status: itemUnits.status, itemId: items.id, name: items.name, container: items.container })
      .from(itemUnits)
      .innerJoin(items, eq(items.id, itemUnits.itemId))
      .where(eq(itemUnits.parentUnitId, unitId))
      .orderBy(asc(items.name), asc(itemUnits.serial)),
    tx
      .select({ itemId: unitContents.itemId, quantity: unitContents.quantity, name: items.name, sku: items.sku })
      .from(unitContents)
      .innerJoin(items, eq(items.id, unitContents.itemId))
      .where(eq(unitContents.containerUnitId, unitId))
      .orderBy(asc(items.name)),
    tx.select().from(unitEvents).where(eq(unitEvents.unitId, unitId)).orderBy(desc(unitEvents.createdAt)).limit(200),
    tx.select().from(repairs).where(eq(repairs.unitId, unitId)).orderBy(desc(repairs.createdAt)).limit(50),
    tx.select().from(inspections).where(eq(inspections.unitId, unitId)).orderBy(desc(inspections.inspectedAt)).limit(50),
  ]);
  const whId = unit.warehouseId ?? row.item.warehouseId;
  return {
    unit,
    item: row.item,
    parent: parent[0] ?? null,
    order: order[0] ?? null,
    warehouses: whs,
    warehouseName: whs.find((w) => w.id === whId)?.name ?? null,
    shelf: unit.location ?? row.item.location,
    children,
    bulk: bulk.map((b) => ({ ...b, quantity: Number(b.quantity) })),
    events,
    repairs: reps,
    inspections: insps,
  };
}
