"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, itemUnits, items, kitItems, kits, movements, stockCounts } from "@rentevent/db";
import { PART_ROLES } from "@rentevent/core";
import { audit, diffOf } from "../audit";
import { tenantAction, UserError } from "../action";
import { UNIT_STATUS_LABEL } from "../warehouse/logic";
import { logUnitEvents, moveUnit as moveUnitSvc, packUnit as packUnitSvc, setBulkContent as setBulkSvc, unpackUnit as unpackUnitSvc } from "../warehouse/tracking";

const itemInput = z.object({
  id: z.string().uuid().nullable(),
  sku: z.string().trim().min(1, "Obligatorio").max(40),
  name: z.string().trim().min(2, "Obligatorio").max(120),
  category: z.string().trim().min(1).max(60),
  kind: z.enum(["granel", "seriado", "consumible", "servicio"]),
  unit: z.enum(["ud", "m2", "m", "ml", "rollo", "kg"]),
  role: z.enum(PART_ROLES),
  roleAmount: z.coerce.number().positive().default(1),
  weightKg: z.coerce.number().min(0),
  volumeM3: z.coerce.number().min(0),
  lengthM: z.coerce.number().min(0).nullable().optional(),
  widthM: z.coerce.number().min(0).nullable().optional(),
  heightM: z.coerce.number().min(0).nullable().optional(),
  price: z.coerce.number().min(0),
  priceMode: z.enum(["unidad", "dia", "periodo", "m2", "ml", "incluido", "hora", "km"]),
  costPrice: z.coerce.number().min(0),
  replacementCost: z.coerce.number().min(0).default(0),
  stockTotal: z.coerce.number().min(0),
  location: z.string().trim().max(40).nullable(),
  description: z.string().trim().max(1000).nullable(),
  inspectionIntervalDays: z.coerce.number().int().min(0).nullable(),
  active: z.boolean().default(true),
  // optional: forms that do not show it must not reset it
  container: z.enum(["caja", "conjunto"]).nullable().optional(),
});

export const saveItem = tenantAction(itemInput, "inventario", async (input, tx, ctx) => {
  const { id, ...values } = input;
  if (id) {
    const [before] = await tx.select().from(items).where(eq(items.id, id));
    if (!before) throw new UserError("Artículo no encontrado");
    if (values.stockTotal !== Number(before.stockTotal)) {
      await tx.insert(movements).values({ itemId: id, kind: "ajuste", quantity: values.stockTotal - Number(before.stockTotal), userId: ctx.user.id, note: "Ajuste de stock manual" });
    }
    await tx.update(items).set({ ...values, pendingValidation: false }).where(eq(items.id, id));
    await audit(tx, ctx, "item", id, "editar", diffOf(before, { ...before, ...values }));
    revalidatePath(`/app/inventario/${id}`);
    revalidatePath("/app/inventario");
    return { id };
  }
  const [row] = await tx.insert(items).values(values).returning({ id: items.id });
  await audit(tx, ctx, "item", row!.id, "crear");
  revalidatePath("/app/inventario");
  return { id: row!.id };
});

/** Inline edit from the table (single field). */
export const patchItem = tenantAction(
  z.object({ id: z.string().uuid(), field: z.enum(["stockTotal", "price", "location", "name", "category"]), value: z.string().max(120) }),
  "inventario",
  async ({ id, field, value }, tx, ctx) => {
    const [before] = await tx.select().from(items).where(eq(items.id, id));
    if (!before) throw new UserError("Artículo no encontrado");
    const numeric = field === "stockTotal" || field === "price";
    const v = numeric ? Number(value.replace(",", ".")) : value.trim();
    if (numeric && (!Number.isFinite(v) || (v as number) < 0)) throw new UserError("Valor no válido");
    if (field === "stockTotal") await tx.insert(movements).values({ itemId: id, kind: "ajuste", quantity: (v as number) - Number(before.stockTotal), userId: ctx.user.id, note: "Ajuste en tabla" });
    await tx.update(items).set({ [field]: v }).where(eq(items.id, id));
    await audit(tx, ctx, "item", id, "editar", { [field]: { de: before[field], a: v } });
    revalidatePath("/app/inventario");
    return { id };
  },
);

export const addUnits = tenantAction(z.object({ itemId: z.string().uuid(), count: z.coerce.number().int().min(1).max(500) }), "inventario", async ({ itemId, count }, tx, ctx) => {
  const [it] = await tx.select().from(items).where(eq(items.id, itemId));
  if (!it) throw new UserError("Artículo no encontrado");
  const existing = await tx.select({ serial: itemUnits.serial }).from(itemUnits).where(eq(itemUnits.itemId, itemId));
  let n = existing.length;
  const rows = Array.from({ length: count }, () => {
    n++;
    const serial = `${it.sku}-${String(n).padStart(3, "0")}`;
    return { itemId, serial, qrCode: `RV-${serial}` };
  });
  const created = await tx.insert(itemUnits).values(rows).onConflictDoNothing().returning({ id: itemUnits.id });
  await logUnitEvents(tx, ctx, created.map((u) => u.id), "alta", { note: "Unidad dada de alta" });
  if (it.kind !== "seriado") await tx.update(items).set({ kind: "seriado" }).where(eq(items.id, itemId));
  await audit(tx, ctx, "item", itemId, "editar", { unidadesSeriadas: count });
  revalidatePath(`/app/inventario/${itemId}`);
  return { count };
});

export const setUnitStatus = tenantAction(
  z.object({ id: z.string().uuid(), status: z.enum(["disponible", "reparacion", "limpieza", "baja", "perdida"]) }),
  "inventario",
  async ({ id, status }, tx, ctx) => {
    const [before] = await tx.select().from(itemUnits).where(eq(itemUnits.id, id));
    if (!before) throw new UserError("Unidad no encontrada");
    if (before.status === status) return { id };
    // back in the warehouse (or written off) means it is no longer out on an order
    const [u] = await tx.update(itemUnits).set({ status, currentOrderId: status === "perdida" ? before.currentOrderId : null }).where(eq(itemUnits.id, id)).returning();
    await logUnitEvents(tx, ctx, [id], "estado", { note: `${UNIT_STATUS_LABEL[before.status] ?? before.status} → ${UNIT_STATUS_LABEL[status]}` });
    await audit(tx, ctx, "item_unit", id, "estado", { status });
    revalidatePath(`/app/inventario/${u!.itemId}`);
    revalidatePath(`/app/inventario/unidades/${id}`);
    return { id };
  },
);

export const saveKit = tenantAction(
  z.object({ id: z.string().uuid().nullable(), sku: z.string().trim().min(1).max(40), name: z.string().trim().min(2).max(120), price: z.coerce.number().min(0), description: z.string().max(500).nullable(), lines: z.array(z.object({ itemId: z.string().uuid(), quantity: z.coerce.number().positive() })).min(1, "Añade al menos un artículo") }),
  "inventario",
  async (input, tx, ctx) => {
    let id = input.id;
    if (id) await tx.update(kits).set({ sku: input.sku, name: input.name, price: input.price, description: input.description }).where(eq(kits.id, id));
    else id = (await tx.insert(kits).values({ sku: input.sku, name: input.name, price: input.price, description: input.description }).returning({ id: kits.id }))[0]!.id;
    await tx.delete(kitItems).where(eq(kitItems.kitId, id));
    await tx.insert(kitItems).values(input.lines.map((l) => ({ ...l, kitId: id! })));
    await audit(tx, ctx, "kit", id, input.id ? "editar" : "crear");
    revalidatePath("/app/inventario/kits");
    return { id };
  },
);

export const deleteKit = tenantAction(z.object({ id: z.string().uuid() }), "inventario", async ({ id }, tx, ctx) => {
  await tx.delete(kits).where(eq(kits.id, id));
  await audit(tx, ctx, "kit", id, "borrar");
  revalidatePath("/app/inventario/kits");
  return { id };
});

/** Cyclic count: records the count and optionally applies the difference. */
export const recordCount = tenantAction(z.object({ itemId: z.string().uuid(), counted: z.coerce.number().min(0), apply: z.boolean() }), "almacen", async (input, tx, ctx) => {
  const [it] = await tx.select().from(items).where(eq(items.id, input.itemId));
  if (!it) throw new UserError("Artículo no encontrado");
  await tx.insert(stockCounts).values({ itemId: input.itemId, expected: Number(it.stockTotal), counted: input.counted, countedBy: ctx.user.name, applied: input.apply });
  if (input.apply && input.counted !== Number(it.stockTotal)) {
    await tx.update(items).set({ stockTotal: input.counted }).where(eq(items.id, input.itemId));
    await tx.insert(movements).values({ itemId: input.itemId, kind: "ajuste", quantity: input.counted - Number(it.stockTotal), userId: ctx.user.id, note: "Inventario cíclico" });
  }
  await audit(tx, ctx, "item", input.itemId, "editar", { recuento: input.counted });
  revalidatePath(`/app/inventario/${input.itemId}`);
  return { diff: input.counted - Number(it.stockTotal) };
});

// ───────────── Cases, sets and unit location ─────────────

const revalidateUnit = (...ids: (string | null | undefined)[]) => {
  for (const id of ids) if (id) revalidatePath(`/app/inventario/unidades/${id}`);
  revalidatePath("/app/inventario/unidades");
};

export const packUnit = tenantAction(z.object({ containerId: z.string().uuid(), code: z.string().trim().min(1, "Escribe o escanea un código").max(300) }), "almacen", async ({ containerId, code }, tx, ctx) => {
  const r = await packUnitSvc(tx, ctx, containerId, code);
  revalidateUnit(containerId);
  return r;
});

export const unpackUnit = tenantAction(z.object({ unitId: z.string().uuid() }), "almacen", async ({ unitId }, tx, ctx) => {
  const r = await unpackUnitSvc(tx, ctx, unitId);
  revalidateUnit(unitId, r.containerId);
  return r;
});

export const setUnitContent = tenantAction(
  z.object({ containerId: z.string().uuid(), itemId: z.string().uuid(), quantity: z.coerce.number().min(0).max(10_000) }),
  "almacen",
  async ({ containerId, itemId, quantity }, tx, ctx) => {
    await setBulkSvc(tx, ctx, containerId, itemId, quantity);
    revalidateUnit(containerId);
    return { ok: true };
  },
);

export const moveUnit = tenantAction(
  z.object({ unitId: z.string().uuid(), warehouseId: z.string().uuid().nullable(), location: z.string().trim().max(40).nullable() }),
  "almacen",
  async ({ unitId, warehouseId, location }, tx, ctx) => {
    await moveUnitSvc(tx, ctx, unitId, warehouseId, location || null);
    revalidateUnit(unitId);
    return { ok: true };
  },
);

export const saveUnitNotes = tenantAction(z.object({ unitId: z.string().uuid(), serial: z.string().trim().min(1, "Obligatorio").max(60), notes: z.string().trim().max(1000).nullable() }), "inventario", async ({ unitId, serial, notes }, tx, ctx) => {
  const [u] = await tx.update(itemUnits).set({ serial, notes: notes || null }).where(eq(itemUnits.id, unitId)).returning({ itemId: itemUnits.itemId });
  if (!u) throw new UserError("Unidad no encontrada");
  await audit(tx, ctx, "item_unit", unitId, "editar", { serial, notes });
  revalidateUnit(unitId);
  revalidatePath(`/app/inventario/${u.itemId}`);
  return { ok: true };
});
