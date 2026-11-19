"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, deliveryNotes, eq, inArray, itemUnits, items, orders, pickListLines, pickLists } from "@rentevent/db";
import { tenantAction, UserError } from "../action";
import { audit } from "../audit";
import { nextCounter } from "../numbering";
import { clampCount, deliveryNoteNumber, matchScan } from "../warehouse/logic";
import { closeReturn as closeReturnSvc, createPickList, loadPickList, markLoaded as markLoadedSvc, refreshStatuses } from "../warehouse/picklists";

const id = z.string().uuid();

export const openPickList = tenantAction(z.object({ orderId: id, kind: z.enum(["salida", "retorno"]) }), "almacen", async ({ orderId, kind }, tx, ctx) => {
  const listId = await createPickList(tx, ctx, orderId, kind);
  await refreshStatuses(tx, listId);
  revalidatePath("/app/almacen");
  return { id: listId };
});

export const updatePickLine = tenantAction(
  z.object({ lineId: id, field: z.enum(["prepared", "loaded", "returned", "damaged", "lost"]), value: z.number().min(0).max(1e6) }),
  "almacen",
  async ({ lineId, field, value }, tx) => {
    const [line] = await tx.select().from(pickListLines).where(eq(pickListLines.id, lineId));
    if (!line) throw new UserError("Línea no encontrada");
    const [list] = await tx.select().from(pickLists).where(eq(pickLists.id, line.pickListId));
    if (!list || list.status === "en_obra" || (list.kind === "retorno" && list.status === "devuelto")) throw new UserError("La lista ya está cerrada.");
    const q = Number(line.quantity);
    let max = q;
    if (field === "returned") max = q - Number(line.damaged) - Number(line.lost);
    if (field === "damaged") max = q - Number(line.returned) - Number(line.lost);
    if (field === "lost") max = q - Number(line.returned) - Number(line.damaged);
    const v = clampCount(value, max);
    const patch: Record<string, number> = { [field]: v };
    if (field === "loaded" && v > Number(line.prepared)) patch.prepared = v;
    await tx.update(pickListLines).set(patch).where(eq(pickListLines.id, lineId));
    const status = await refreshStatuses(tx, line.pickListId);
    revalidatePath(`/app/almacen/${line.pickListId}`);
    return { value: v, status };
  },
);

export const markAll = tenantAction(z.object({ listId: id, field: z.enum(["prepared", "loaded", "returned"]) }), "almacen", async ({ listId, field }, tx, ctx) => {
  const data = await loadPickList(tx, listId);
  if (!data) throw new UserError("Lista no encontrada");
  for (const l of data.lines) {
    if (field === "returned") await tx.update(pickListLines).set({ returned: Math.max(0, l.quantity - l.damaged - l.lost) }).where(eq(pickListLines.id, l.id));
    else await tx.update(pickListLines).set(field === "loaded" ? { prepared: l.quantity, loaded: l.quantity } : { prepared: l.quantity }).where(eq(pickListLines.id, l.id));
  }
  await refreshStatuses(tx, listId);
  await audit(tx, ctx, "pick_list", listId, "editar", { todo: field });
  revalidatePath(`/app/almacen/${listId}`);
  return { ok: true };
});

/** Scan: serial QR (item_units.qr_code) or the item SKU; increments prepared (salida) or returned (retorno). */
export const scanCode = tenantAction(z.object({ listId: id, code: z.string().trim().min(1).max(120) }), "almacen", async ({ listId, code }, tx) => {
  const data = await loadPickList(tx, listId);
  if (!data) throw new UserError("Lista no encontrada");
  const units = await tx.select({ qr: itemUnits.qrCode, itemId: itemUnits.itemId, serial: itemUnits.serial }).from(itemUnits).where(eq(itemUnits.qrCode, code.trim()));
  const hit = matchScan(code, data.lines, new Map(units.map((u) => [u.qr, { itemId: u.itemId, serial: u.serial }])));
  if (!hit) {
    const [other] = units.length ? await tx.select({ name: items.name }).from(items).where(eq(items.id, units[0]!.itemId)) : [undefined];
    throw new UserError(other ? `${other.name} no está en esta lista.` : `Código ${code} no reconocido.`);
  }
  const line = data.lines.find((l) => l.id === hit.lineId)!;
  if (hit.serial && line.scannedUnits.includes(hit.serial)) throw new UserError(`La unidad ${hit.serial} ya está escaneada.`);
  const field = data.list.kind === "salida" ? "prepared" : "returned";
  const current = field === "prepared" ? line.prepared : line.returned;
  const max = field === "prepared" ? line.quantity : line.quantity - line.damaged - line.lost;
  if (current >= max) throw new UserError(`${line.name}: ya están las ${line.quantity} unidades.`);
  await tx
    .update(pickListLines)
    .set({ [field]: current + 1, scannedUnits: hit.serial ? [...line.scannedUnits, hit.serial] : line.scannedUnits })
    .where(eq(pickListLines.id, line.id));
  await refreshStatuses(tx, listId);
  revalidatePath(`/app/almacen/${listId}`);
  return { name: line.name, serial: hit.serial, count: current + 1, quantity: line.quantity };
});

export const markLoaded = tenantAction(z.object({ listId: id }), "almacen", async ({ listId }, tx, ctx) => {
  const r = await markLoadedSvc(tx, ctx, listId);
  revalidatePath(`/app/almacen/${listId}`);
  revalidatePath("/app/almacen");
  return r;
});

export const closeReturn = tenantAction(
  z.object({
    listId: id,
    missingAsLost: z.boolean(),
    lines: z.array(z.object({ lineId: id, returned: z.number().min(0), damaged: z.number().min(0), lost: z.number().min(0), dirty: z.boolean(), note: z.string().max(300).nullable().optional() })).max(500),
  }),
  "almacen",
  async ({ listId, lines, missingAsLost }, tx, ctx) => {
    const r = await closeReturnSvc(tx, ctx, listId, lines, missingAsLost);
    revalidatePath(`/app/almacen/${listId}`);
    revalidatePath("/app/almacen/retornos");
    revalidatePath("/app/mantenimiento");
    return r;
  },
);

/** Delivery / pickup note from a pick list: snapshot of the lines. */
export const createDeliveryNote = tenantAction(z.object({ listId: id }), "almacen", async ({ listId }, tx, ctx) => {
  const data = await loadPickList(tx, listId);
  if (!data) throw new UserError("Lista no encontrada");
  const kind = data.list.kind === "salida" ? "entrega" : "recogida";
  const [existing] = await tx.select({ id: deliveryNotes.id }).from(deliveryNotes).where(and(eq(deliveryNotes.orderId, data.list.orderId), eq(deliveryNotes.kind, kind)));
  if (existing) return { id: existing.id };
  const n = await nextCounter(tx, "albaran");
  const lines = data.lines.map((l) => ({
    itemId: l.itemId,
    name: l.name,
    sku: l.sku,
    unit: l.unit,
    quantity: kind === "entrega" ? (l.loaded || l.prepared || l.quantity) : l.returned + l.damaged,
    damaged: kind === "recogida" ? l.damaged : 0,
    serials: l.scannedUnits,
  }));
  const [row] = await tx.insert(deliveryNotes).values({ orderId: data.list.orderId, kind, number: deliveryNoteNumber(new Date().getFullYear(), n), lines }).returning({ id: deliveryNotes.id });
  await audit(tx, ctx, "delivery_note", row!.id, "crear", { pedido: data.order?.number });
  revalidatePath("/app/almacen/albaranes");
  return { id: row!.id };
});

export const signDeliveryNote = tenantAction(
  z.object({ id, name: z.string().trim().min(2, "Indica quién firma").max(120), signature: z.string().startsWith("data:image/png;base64,").max(600_000) }),
  "almacen",
  async (input, tx, ctx) => {
    const [n] = await tx.select().from(deliveryNotes).where(eq(deliveryNotes.id, input.id));
    if (!n) throw new UserError("Albarán no encontrado");
    if (n.signedAt) throw new UserError("El albarán ya está firmado.");
    await tx.update(deliveryNotes).set({ signedName: input.name, signature: input.signature, signedAt: new Date() }).where(eq(deliveryNotes.id, input.id));
    await audit(tx, ctx, "delivery_note", input.id, "aceptar", { firmante: input.name });
    revalidatePath(`/app/almacen/albaranes/${input.id}`);
    return { ok: true };
  },
);

/** Orders whose lists can be opened from the warehouse lists. */
export const ordersWithoutList = tenantAction(z.object({ kind: z.enum(["salida", "retorno"]) }), "almacen", async ({ kind }, tx) => {
  const statuses = kind === "salida" ? ["confirmado", "opcion"] : ["en_curso"];
  const rows = await tx.select({ id: orders.id, number: orders.number, title: orders.title, periodStart: orders.periodStart, periodEnd: orders.periodEnd }).from(orders).where(inArray(orders.status, statuses));
  const lists = await tx.select({ orderId: pickLists.orderId }).from(pickLists).where(eq(pickLists.kind, kind));
  const have = new Set(lists.map((l) => l.orderId));
  return rows.filter((r) => !have.has(r.id));
});
