"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, deliveryNotes, eq, inArray, items, ne, orders, pickListLines, pickLists } from "@rentevent/db";
import { tenantAction, UserError } from "../action";
import { audit } from "../audit";
import { nextCounter } from "../numbering";
import { clampCount, containerScanPlan, deliveryNoteNumber, matchScan, normalizeCode, type PickKind } from "../warehouse/logic";
import { containerContents, findUnitByCode } from "../warehouse/tracking";
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
  if (data.list.status === "en_obra" || (data.list.kind === "retorno" && data.list.status === "devuelto")) throw new UserError("La lista ya está cerrada.");
  for (const l of data.lines) {
    if (field === "returned") await tx.update(pickListLines).set({ returned: Math.max(0, l.quantity - l.damaged - l.lost) }).where(eq(pickListLines.id, l.id));
    else await tx.update(pickListLines).set(field === "loaded" ? { prepared: l.quantity, loaded: l.quantity } : { prepared: l.quantity }).where(eq(pickListLines.id, l.id));
  }
  await refreshStatuses(tx, listId);
  await audit(tx, ctx, "pick_list", listId, "editar", { todo: field });
  revalidatePath(`/app/almacen/${listId}`);
  return { ok: true };
});

const STATUS_TEXT: Record<string, string> = { disponible: "disponible", en_obra: "fuera en otro evento", reparacion: "en reparación", limpieza: "en limpieza", baja: "dada de baja", perdida: "perdida" };

/**
 * Scan on a pick list. Accepts a unit QR (or label URL), a serial number or an
 * item SKU. A case or set counts everything packed inside it at once.
 * Outgoing lists only take available units; returns only units out on this order.
 */
export const scanCode = tenantAction(z.object({ listId: id, code: z.string().trim().min(1).max(300) }), "almacen", async ({ listId, code: raw }, tx) => {
  const data = await loadPickList(tx, listId);
  if (!data) throw new UserError("Lista no encontrada");
  if (data.list.status === "en_obra" || (data.list.kind === "retorno" && data.list.status === "devuelto")) throw new UserError("La lista ya está cerrada.");
  const kind = data.list.kind as PickKind;
  const orderId = data.list.orderId;
  const field = kind === "salida" ? "prepared" : "returned";
  const code = normalizeCode(raw);
  const hit = await findUnitByCode(tx, code);
  const usable = (u: { status: string; currentOrderId: string | null }) =>
    kind === "salida" ? u.status === "disponible" : u.status === "en_obra" && (u.currentOrderId === orderId || u.currentOrderId === null);
  const refuse = (name: string, u: { serial: string; status: string }) =>
    new UserError(kind === "salida" ? `${name} ${u.serial} no está disponible: ${STATUS_TEXT[u.status] ?? u.status}.` : `${name} ${u.serial} no salió en este pedido.`);

  if (hit?.item.container) {
    if (!usable(hit.unit)) throw refuse(hit.item.name, hit.unit);
    const inside = await containerContents(tx, hit.unit.id);
    const ownLine = data.lines.some((l) => l.itemId === hit.unit.itemId);
    const candidates = [...(ownLine ? [{ ...hit.unit, container: hit.item.container }] : []), ...inside.units];
    const ok = candidates.filter(usable);
    const bad = candidates.filter((u) => !usable(u) && !u.container);
    const plan = containerScanPlan(data.lines, kind, { units: ok.filter((u) => ownLine || u.id !== hit.unit.id), bulk: inside.bulk });
    const changed = plan.updates.filter((u) => {
      const l = data.lines.find((x) => x.id === u.lineId)!;
      return u.count !== l[field] || u.serials.length !== l.scannedUnits.length;
    });
    for (const u of changed) await tx.update(pickListLines).set({ [field]: u.count, scannedUnits: u.serials }).where(eq(pickListLines.id, u.lineId));
    const boxes = [hit.unit.id, ...inside.units.filter((u) => u.container && usable(u)).map((u) => u.id)];
    await tx.update(pickLists).set({ scannedContainers: [...new Set([...data.list.scannedContainers, ...boxes])] }).where(eq(pickLists.id, listId));
    await refreshStatuses(tx, listId);
    revalidatePath(`/app/almacen/${listId}`);
    const names = new Map((await tx.select({ id: items.id, name: items.name }).from(items).where(inArray(items.id, [...new Set([...plan.skipped.map((x) => x.itemId), ...bad.map((b) => b.itemId)])].concat(hit.unit.itemId)))).map((i) => [i.id, i.name]));
    const notOnList = plan.skipped.filter((x) => x.reason === "no_en_lista" && !inside.units.some((u) => u.serial === x.serial && u.container));
    const full = plan.skipped.filter((x) => x.reason === "completo");
    const warnings = [
      ...bad.map((u) => `${names.get(u.itemId) ?? ""} ${u.serial}: ${kind === "salida" ? STATUS_TEXT[u.status] ?? u.status : "no salió en este pedido"}`),
      ...(notOnList.length ? [`No están en este pedido: ${[...new Set(notOnList.map((x) => names.get(x.itemId)))].join(", ")}`] : []),
      ...(full.length ? [`Ya completos: ${[...new Set(full.map((x) => names.get(x.itemId)))].join(", ")}`] : []),
    ];
    if (plan.added === 0 && !changed.length) throw new UserError(`${hit.item.name} ${hit.unit.serial}: no hay nada que sumar a esta lista.${warnings.length ? ` ${warnings.join(". ")}.` : ""}`);
    return {
      message: `${hit.item.name} ${hit.unit.serial}: ${plan.added} ${plan.added === 1 ? "unidad" : "unidades"}`,
      field,
      lines: changed.map((u) => ({ id: u.lineId, count: u.count, scannedUnits: u.serials })),
      warnings,
    };
  }

  if (hit && !usable(hit.unit)) throw refuse(hit.item.name, hit.unit);
  const hitLine = matchScan(code, data.lines, hit ? new Map([[code, { itemId: hit.unit.itemId, serial: hit.unit.serial }]]) : new Map());
  if (!hitLine) throw new UserError(hit ? `${hit.item.name} no está en esta lista.` : `Código ${code} no reconocido.`);
  const line = data.lines.find((l) => l.id === hitLine.lineId)!;
  if (hitLine.serial && line.scannedUnits.includes(hitLine.serial)) throw new UserError(`La unidad ${hitLine.serial} ya está escaneada.`);
  const current = line[field];
  const max = field === "prepared" ? line.quantity : line.quantity - line.damaged - line.lost;
  if (current >= max) throw new UserError(`${line.name}: ya están las ${line.quantity} unidades.`);
  const scannedUnits = hitLine.serial ? [...line.scannedUnits, hitLine.serial] : line.scannedUnits;
  await tx.update(pickListLines).set({ [field]: current + 1, scannedUnits }).where(eq(pickListLines.id, line.id));
  await refreshStatuses(tx, listId);
  revalidatePath(`/app/almacen/${listId}`);
  return {
    message: `${line.name}${hitLine.serial ? ` · ${hitLine.serial}` : ""} (${current + 1}/${line.quantity})`,
    field,
    lines: [{ id: line.id, count: current + 1, scannedUnits }],
    warnings: [] as string[],
  };
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

/** Orders whose lists can be opened from the warehouse lists (for returns: also partial returns with material still out). */
export const ordersWithoutList = tenantAction(z.object({ kind: z.enum(["salida", "retorno"]) }), "almacen", async ({ kind }, tx) => {
  const statuses = kind === "salida" ? ["confirmado", "opcion"] : ["en_curso"];
  const rows = await tx.select({ id: orders.id, number: orders.number, title: orders.title, periodStart: orders.periodStart, periodEnd: orders.periodEnd }).from(orders).where(inArray(orders.status, statuses));
  const lists = await tx.select({ orderId: pickLists.orderId }).from(pickLists).where(kind === "retorno" ? and(eq(pickLists.kind, kind), ne(pickLists.status, "devuelto")) : eq(pickLists.kind, kind));
  const have = new Set(lists.map((l) => l.orderId));
  return rows.filter((r) => !have.has(r.id));
});
