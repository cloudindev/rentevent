import "server-only";
import { and, desc, eq, inspections, isNotNull, itemUnits, items, movements, repairs, sql, type Tx } from "@rentevent/db";
import { UserError } from "../action";
import { audit } from "../audit";
import type { AppContext } from "../context";
import { inspectionDue, type InspectionStatus } from "./logic";
import { logUnitEvents } from "./tracking";

type Ctx = Pick<AppContext, "user">;
const OPEN = ["pendiente", "en_curso"];

/** Opens a repair or cleaning: the quantity leaves availability through items.stockRepair. */
export async function openRepair(tx: Tx, ctx: Ctx, input: { itemId: string; unitId?: string | null; quantity: number; kind: "reparacion" | "limpieza"; reason: string; orderId?: string | null }) {
  const [it] = await tx.select().from(items).where(eq(items.id, input.itemId));
  if (!it) throw new UserError("Artículo no encontrado");
  const free = Number(it.stockTotal) - Number(it.stockRepair);
  if (input.quantity > free) throw new UserError(`Solo hay ${free} unidades fuera de reparación.`);
  const [r] = await tx.insert(repairs).values({ itemId: input.itemId, unitId: input.unitId ?? null, orderId: input.orderId ?? null, quantity: input.quantity, kind: input.kind, status: "pendiente", reason: input.reason }).returning({ id: repairs.id });
  await tx.update(items).set({ stockRepair: sql`${items.stockRepair} + ${input.quantity}` }).where(eq(items.id, input.itemId));
  await tx.insert(movements).values({ itemId: input.itemId, unitId: input.unitId ?? null, kind: "reparacion_alta", quantity: input.quantity, userId: ctx.user.id, note: input.kind === "limpieza" ? "A limpieza" : input.reason });
  if (input.unitId) {
    await tx.update(itemUnits).set({ status: input.kind === "limpieza" ? "limpieza" : "reparacion", currentOrderId: null }).where(eq(itemUnits.id, input.unitId));
    await logUnitEvents(tx, ctx, [input.unitId], input.kind, { orderId: input.orderId ?? null, note: input.reason });
  }
  await audit(tx, ctx, "repair", r!.id, "crear", { kind: input.kind, cantidad: input.quantity });
  return r!.id;
}

/**
 * Moves a repair through pendiente → en_curso → reparado | baja.
 * Closing returns the units to availability; "baja" also removes them from stock.
 */
export async function setRepairStatus(tx: Tx, ctx: Ctx, input: { id: string; status: "pendiente" | "en_curso" | "reparado" | "baja"; cost?: number; resolution?: string | null }) {
  const [r] = await tx.select().from(repairs).where(eq(repairs.id, input.id)).for("update");
  if (!r) throw new UserError("Reparación no encontrada");
  const wasOpen = OPEN.includes(r.status);
  const closing = input.status === "reparado" || input.status === "baja";
  if (!wasOpen && closing) throw new UserError("Esta reparación ya está cerrada.");
  if (!wasOpen && !closing) throw new UserError("No se puede reabrir una reparación cerrada; crea una nueva.");
  const q = Number(r.quantity);
  await tx
    .update(repairs)
    .set({ status: input.status, cost: input.cost ?? r.cost, resolution: input.resolution ?? r.resolution, closedAt: closing ? new Date() : null })
    .where(eq(repairs.id, input.id));
  if (closing) {
    await tx.update(items).set({ stockRepair: sql`greatest(0, ${items.stockRepair} - ${q})` }).where(eq(items.id, r.itemId));
    await tx.insert(movements).values({ itemId: r.itemId, unitId: r.unitId, kind: "reparacion_baja", quantity: q, userId: ctx.user.id, note: input.status === "baja" ? "Dado de baja" : r.kind === "limpieza" ? "Limpieza terminada" : "Reparado" });
    if (input.status === "baja") {
      await tx.update(items).set({ stockTotal: sql`greatest(0, ${items.stockTotal} - ${q})` }).where(eq(items.id, r.itemId));
      await tx.insert(movements).values({ itemId: r.itemId, unitId: r.unitId, kind: "perdida", quantity: -q, userId: ctx.user.id, note: "Baja tras reparación" });
    }
    if (r.unitId) {
      await tx.update(itemUnits).set({ status: input.status === "baja" ? "baja" : "disponible" }).where(eq(itemUnits.id, r.unitId));
      await logUnitEvents(tx, ctx, [r.unitId], input.status === "baja" ? "baja" : "reparado", { note: input.resolution ?? (r.kind === "limpieza" ? "Limpieza terminada" : null) });
    }
  }
  await audit(tx, ctx, "repair", input.id, "estado", { de: r.status, a: input.status });
}

/** Records an inspection; "no apto" automatically opens a repair. */
export async function recordInspection(tx: Tx, ctx: Ctx, input: { itemId: string; unitId?: string | null; result: "ok" | "defectos" | "no_apto"; notes?: string | null; inspector: string; quantity?: number }) {
  const [it] = await tx.select().from(items).where(eq(items.id, input.itemId));
  if (!it) throw new UserError("Artículo no encontrado");
  const now = new Date();
  const nextDueAt = it.inspectionIntervalDays ? new Date(now.getTime() + it.inspectionIntervalDays * 86_400_000) : null;
  const [row] = await tx.insert(inspections).values({ itemId: input.itemId, unitId: input.unitId ?? null, kind: "revision", result: input.result, inspector: input.inspector, notes: input.notes ?? null, inspectedAt: now, nextDueAt }).returning({ id: inspections.id });
  if (input.unitId) {
    await tx.update(itemUnits).set({ lastInspectionAt: now }).where(eq(itemUnits.id, input.unitId));
    await logUnitEvents(tx, ctx, [input.unitId], "revision", { note: `${input.result === "ok" ? "Apta" : input.result === "defectos" ? "Con defectos" : "No apta"}${input.notes ? ` · ${input.notes}` : ""}` });
  }
  let repairId: string | null = null;
  if (input.result === "no_apto") {
    repairId = await openRepair(tx, ctx, { itemId: input.itemId, unitId: input.unitId, quantity: input.quantity ?? 1, kind: "reparacion", reason: `Revisión no apta${input.notes ? `: ${input.notes}` : ""}` });
  }
  await audit(tx, ctx, "inspection", row!.id, "crear", { resultado: input.result });
  return { id: row!.id, repairId, nextDueAt };
}

export type DueRow = { key: string; itemId: string; unitId: string | null; name: string; serial: string | null; category: string; last: Date | null; nextDue: Date | null; status: InspectionStatus; daysLeft: number | null };

/** Inspection plan: per item (bulk) or per serial unit, sorted by urgency. */
export async function inspectionPlan(tx: Tx, now = new Date()): Promise<DueRow[]> {
  const its = await tx.select().from(items).where(and(isNotNull(items.inspectionIntervalDays), eq(items.active, true)));
  const lastRows = await tx
    .select({ itemId: inspections.itemId, unitId: inspections.unitId, last: sql<Date>`max(${inspections.inspectedAt})` })
    .from(inspections)
    .groupBy(inspections.itemId, inspections.unitId);
  const lastItem = new Map(lastRows.filter((r) => !r.unitId).map((r) => [r.itemId, new Date(r.last)]));
  const units = await tx.select().from(itemUnits);
  const out: DueRow[] = [];
  for (const it of its) {
    const myUnits = units.filter((u) => u.itemId === it.id && u.status !== "baja");
    if (it.kind === "seriado" && myUnits.length) {
      for (const u of myUnits) {
        const due = inspectionDue(it.inspectionIntervalDays, u.lastInspectionAt, u.createdAt, now);
        out.push({ key: u.id, itemId: it.id, unitId: u.id, name: it.name, serial: u.serial, category: it.category, last: u.lastInspectionAt, ...due });
      }
    } else {
      const last = lastItem.get(it.id) ?? null;
      const due = inspectionDue(it.inspectionIntervalDays, last, it.createdAt, now);
      out.push({ key: it.id, itemId: it.id, unitId: null, name: it.name, serial: null, category: it.category, last, ...due });
    }
  }
  const rank = { vencida: 0, proxima: 1, ok: 2, sin_plan: 3 } as const;
  return out.sort((a, b) => rank[a.status] - rank[b.status] || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
}

export async function itemHistory(tx: Tx, itemId: string) {
  const [mv, rp, ins] = await Promise.all([
    tx.select().from(movements).where(eq(movements.itemId, itemId)).orderBy(desc(movements.createdAt)).limit(100),
    tx.select().from(repairs).where(eq(repairs.itemId, itemId)).orderBy(desc(repairs.createdAt)).limit(100),
    tx.select().from(inspections).where(eq(inspections.itemId, itemId)).orderBy(desc(inspections.inspectedAt)).limit(100),
  ]);
  return { movements: mv, repairs: rp, inspections: ins };
}
