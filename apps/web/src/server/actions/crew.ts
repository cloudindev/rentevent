"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  and,
  assignments,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  items,
  itemUnits,
  jobReports,
  lt,
  shifts,
  timeEntries,
  workerUnavailability,
  workers,
  withTenant,
  type Tx,
} from "@rentevent/db";
import { checkAssignment, hasBlockingConflict, suggestCrew, type Conflict } from "@rentevent/core";
import { tenantAction, UserError, zId, zOptText, zText } from "../action";
import { audit, diffOf } from "../audit";
import { getAppContext } from "../context";
import { geocode } from "@/lib/adapters/maps";
import { notify } from "@/lib/adapters/messaging";
import { env } from "@/lib/env";
import { findWorkerForUser, loadCrewWindow } from "../crew/data";
import { generateShiftsForProject } from "../crew/shifts";

const revalidateCrew = () => {
  revalidatePath("/app/personal", "layout");
  revalidatePath("/m", "layout");
};

// ───────────────────────── Workers ─────────────────────────

const workerSchema = z.object({
  id: zId.optional().nullable(),
  name: zText(120).min(2, "Indica el nombre"),
  email: z.union([z.literal(""), z.string().trim().email("Correo no válido")]).optional().nullable(),
  phone: zOptText(40),
  type: z.enum(["plantilla", "eventual", "autonomo"]),
  skills: z.array(z.string().max(40)).max(20),
  trainingExpiresAt: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().nullable(),
  costPerHour: z.coerce.number().min(0).max(500),
  weeklyHoursLimit: z.coerce.number().int().min(1).max(80),
  address: zOptText(300),
  color: zOptText(20),
  active: z.boolean().default(true),
});

export const saveWorker = tenantAction(workerSchema, "personal", async (input, tx, ctx) => {
  let homeLat: number | null = null;
  let homeLng: number | null = null;
  if (input.address) {
    const g = await geocode(input.address);
    if (g) ({ lat: homeLat, lng: homeLng } = g);
  }
  const values = {
    name: input.name,
    email: input.email || null,
    phone: input.phone,
    type: input.type,
    skills: input.skills,
    trainingExpiresAt: input.trainingExpiresAt || null,
    costPerHour: input.costPerHour,
    weeklyHoursLimit: input.weeklyHoursLimit,
    address: input.address,
    homeLat,
    homeLng,
    color: input.color,
    active: input.active,
  };
  if (input.id) {
    const [before] = await tx.select().from(workers).where(eq(workers.id, input.id));
    if (!before) throw new UserError("Trabajador no encontrado");
    const [after] = await tx.update(workers).set(values).where(eq(workers.id, input.id)).returning();
    await audit(tx, ctx, "worker", input.id, "editar", diffOf(before, after));
    revalidateCrew();
    return { id: input.id };
  }
  const [row] = await tx.insert(workers).values(values).returning({ id: workers.id });
  await audit(tx, ctx, "worker", row!.id, "crear", { name: input.name });
  revalidateCrew();
  return { id: row!.id };
});

export const addUnavailability = tenantAction(
  z
    .object({ workerId: zId, kind: z.enum(["vacaciones", "baja", "otro"]), startsAt: z.coerce.date(), endsAt: z.coerce.date(), note: zOptText(300) })
    .refine((v) => v.endsAt > v.startsAt, { message: "La fecha de fin debe ser posterior", path: ["endsAt"] }),
  "personal",
  async (input, tx, ctx) => {
    const [row] = await tx.insert(workerUnavailability).values(input).returning({ id: workerUnavailability.id });
    await audit(tx, ctx, "worker", input.workerId, "editar", { ausencia: input.kind, desde: input.startsAt, hasta: input.endsAt });
    revalidateCrew();
    return { id: row!.id };
  },
);

export const removeUnavailability = tenantAction(z.object({ id: zId }), "personal", async ({ id }, tx, ctx) => {
  const [row] = await tx.delete(workerUnavailability).where(eq(workerUnavailability.id, id)).returning();
  if (row) await audit(tx, ctx, "worker", row.workerId, "editar", { ausencia_eliminada: row.kind });
  revalidateCrew();
  return { id };
});

// ───────────────────────── Assignments ─────────────────────────

async function conflictsFor(tx: Tx, shiftId: string, workerId: string, ignoreAssignmentWorker?: string | null) {
  const [s] = await tx.select().from(shifts).where(eq(shifts.id, shiftId));
  if (!s) throw new UserError("Turno no encontrado");
  const win = await loadCrewWindow(tx, s.startsAt, s.endsAt);
  const worker = win.workerInfos.find((w) => w.id === workerId);
  if (!worker) throw new UserError("Trabajador no encontrado o inactivo");
  const shiftInfo = win.infoById.get(shiftId)!;
  const crewIds = win.assignments.filter((a) => a.shiftId === shiftId && a.status !== "rechazado" && a.workerId !== ignoreAssignmentWorker).map((a) => a.workerId);
  const existing = win.existing.filter((e) => !(e.shift.id === shiftId && e.workerId === ignoreAssignmentWorker));
  const conflicts = checkAssignment({ worker, shift: shiftInfo, existing, crewOnShift: win.workerInfos.filter((w) => crewIds.includes(w.id)) });
  return { shift: s, worker, conflicts };
}

export const previewAssignment = tenantAction(z.object({ shiftId: zId, workerId: zId, replaceWorkerId: zId.optional().nullable() }), "personal", async (input, tx) => {
  const { conflicts } = await conflictsFor(tx, input.shiftId, input.workerId, input.replaceWorkerId);
  return { conflicts };
});

export const assignWorker = tenantAction(
  z.object({ shiftId: zId, workerId: zId, replaceWorkerId: zId.optional().nullable(), overrideReason: zOptText(300) }),
  "personal",
  async (input, tx, ctx) => {
    const { conflicts, shift, worker } = await conflictsFor(tx, input.shiftId, input.workerId, input.replaceWorkerId);
    if (hasBlockingConflict(conflicts)) {
      if (ctx.role !== "administrador") throw new UserError(`No se puede asignar: ${conflicts.filter((c) => c.severity === "error").map((c) => c.message).join(" · ")}`);
      if (!input.overrideReason) throw new UserError("Indica el motivo para forzar la asignación.");
    }
    if (input.replaceWorkerId && input.replaceWorkerId !== input.workerId) {
      await tx.delete(assignments).where(and(eq(assignments.shiftId, input.shiftId), eq(assignments.workerId, input.replaceWorkerId)));
    }
    const reason = input.overrideReason ?? (conflicts.length ? `Avisos aceptados: ${conflicts.map((c) => c.code).join(", ")}` : null);
    await tx
      .insert(assignments)
      .values({ shiftId: input.shiftId, workerId: input.workerId, status: "asignado", overrideReason: reason })
      .onConflictDoUpdate({ target: [assignments.shiftId, assignments.workerId], set: { status: "asignado", overrideReason: reason } });
    await audit(tx, ctx, "shift", input.shiftId, "editar", { asignado: worker.name, avisos: conflicts.map((c) => c.message), forzado: input.overrideReason ?? null });
    if (shift.published) {
      const [w] = await tx.select().from(workers).where(eq(workers.id, input.workerId));
      if (w) await notify(tx, { channel: "push", recipient: w.name, userId: w.userId, title: "Nuevo turno asignado", body: shift.title, entity: "shift", entityId: shift.id, url: `${env.appUrl}/m/turno/${shift.id}` });
    }
    revalidateCrew();
    return { conflicts: conflicts as Conflict[] };
  },
);

export const unassignWorker = tenantAction(z.object({ shiftId: zId, workerId: zId }), "personal", async (input, tx, ctx) => {
  await tx.delete(assignments).where(and(eq(assignments.shiftId, input.shiftId), eq(assignments.workerId, input.workerId)));
  await audit(tx, ctx, "shift", input.shiftId, "editar", { desasignado: input.workerId });
  revalidateCrew();
  return { ok: true };
});

export const suggestForShift = tenantAction(z.object({ shiftId: zId }), "personal", async ({ shiftId }, tx) => {
  const [s] = await tx.select().from(shifts).where(eq(shifts.id, shiftId));
  if (!s) throw new UserError("Turno no encontrado");
  const win = await loadCrewWindow(tx, s.startsAt, s.endsAt);
  const assigned = new Set(win.assignments.filter((a) => a.shiftId === shiftId).map((a) => a.workerId));
  const missing = Math.max(1, s.requiredPeople - assigned.size);
  const ranked = suggestCrew({ shift: win.infoById.get(shiftId)!, workers: win.workerInfos.filter((w) => !assigned.has(w.id)), existing: win.existing, size: 0 });
  return {
    missing,
    suggestions: ranked.slice(0, Math.max(missing + 3, 6)).map((r) => ({ workerId: r.worker.id, name: r.worker.name, score: r.score, reasons: r.reasons, conflicts: r.conflicts, recommended: false })).map((r, i) => ({ ...r, recommended: i < missing && !hasBlockingConflict(r.conflicts) })),
  };
});

export const publishPlanning = tenantAction(z.object({ from: z.coerce.date(), to: z.coerce.date(), channels: z.array(z.enum(["push", "email", "whatsapp"])).min(1) }), "personal", async (input, tx, ctx) => {
  const list = await tx.select().from(shifts).where(and(gte(shifts.startsAt, input.from), lt(shifts.startsAt, input.to)));
  if (list.length === 0) throw new UserError("No hay turnos en ese periodo.");
  const ids = list.map((s) => s.id);
  await tx.update(shifts).set({ published: true }).where(inArray(shifts.id, ids));
  const asg = await tx.select({ workerId: assignments.workerId }).from(assignments).where(inArray(assignments.shiftId, ids));
  const counts = new Map<string, number>();
  for (const a of asg) counts.set(a.workerId, (counts.get(a.workerId) ?? 0) + 1);
  const ws = counts.size ? await tx.select().from(workers).where(inArray(workers.id, [...counts.keys()])) : [];
  let sent = 0;
  for (const w of ws) {
    const n = counts.get(w.id)!;
    const body = `Tienes ${n} turno${n === 1 ? "" : "s"} publicado${n === 1 ? "" : "s"} en tu agenda.`;
    for (const ch of input.channels) {
      const recipient = ch === "email" ? w.email : ch === "whatsapp" ? w.phone : w.name;
      if (!recipient) continue;
      await notify(tx, { channel: ch, recipient, userId: w.userId, title: "Planning publicado", body, entity: "worker", entityId: w.id, url: `${env.appUrl}/m` });
      sent++;
    }
  }
  await audit(tx, ctx, "planning", input.from.toISOString().slice(0, 10), "enviar", { turnos: ids.length, avisos: sent });
  revalidateCrew();
  return { shifts: ids.length, workers: ws.length, notifications: sent };
});

export const generateShifts = tenantAction(z.object({ projectId: zId }), "personal", async ({ projectId }, tx, ctx) => {
  const r = await generateShiftsForProject(tx, projectId);
  await audit(tx, ctx, "project", projectId, "editar", { turnos_generados: r.created.length, omitidas: r.skipped });
  revalidateCrew();
  revalidatePath(`/app/proyectos/${projectId}`);
  return r;
});

const shiftSchema = z
  .object({
    id: zId.optional().nullable(),
    title: zText(160).min(2, "Indica un título"),
    phaseKind: z.enum(["carga", "transporte", "montaje", "desmontaje", "retorno", "otro"]),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    requiredPeople: z.coerce.number().int().min(1).max(40),
    requiredSkills: z.array(z.string().max(40)).max(10),
    vehicleId: zId.optional().nullable(),
    projectId: zId.optional().nullable(),
    address: zOptText(300),
    notes: zOptText(1000),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "La hora de fin debe ser posterior", path: ["endsAt"] });

export const saveShift = tenantAction(shiftSchema, "personal", async (input, tx, ctx) => {
  let lat: number | null = null;
  let lng: number | null = null;
  if (input.address) {
    const g = await geocode(input.address);
    if (g) ({ lat, lng } = g);
  }
  const values = { ...input, id: undefined, vehicleId: input.vehicleId || null, projectId: input.projectId || null, lat, lng };
  if (input.id) {
    await tx.update(shifts).set(values).where(eq(shifts.id, input.id));
    await audit(tx, ctx, "shift", input.id, "editar", { title: input.title });
    revalidateCrew();
    return { id: input.id };
  }
  const [row] = await tx.insert(shifts).values(values).returning({ id: shifts.id });
  await audit(tx, ctx, "shift", row!.id, "crear", { title: input.title });
  revalidateCrew();
  return { id: row!.id };
});

export const deleteShift = tenantAction(z.object({ id: zId }), "personal", async ({ id }, tx, ctx) => {
  await tx.delete(shifts).where(eq(shifts.id, id));
  await audit(tx, ctx, "shift", id, "borrar");
  revalidateCrew();
  return { id };
});

// ───────────────────────── Time register ─────────────────────────

export const correctTimeEntry = tenantAction(
  z
    .object({
      id: zId.optional().nullable(),
      workerId: zId,
      shiftId: zId.optional().nullable(),
      clockIn: z.coerce.date(),
      clockOut: z.coerce.date().optional().nullable(),
      breakMinutes: z.coerce.number().int().min(0).max(600),
      diet: z.boolean(),
      reason: zText(300).min(3, "El motivo es obligatorio para corregir un fichaje"),
    })
    .refine((v) => !v.clockOut || v.clockOut > v.clockIn, { message: "La salida debe ser posterior a la entrada", path: ["clockOut"] }),
  "personal",
  async (input, tx, ctx) => {
    const values = { workerId: input.workerId, shiftId: input.shiftId || null, clockIn: input.clockIn, clockOut: input.clockOut ?? null, breakMinutes: input.breakMinutes, diet: input.diet, editedBy: ctx.user.name, editReason: input.reason };
    if (input.id) {
      const [before] = await tx.select().from(timeEntries).where(eq(timeEntries.id, input.id));
      if (!before) throw new UserError("Fichaje no encontrado");
      const [after] = await tx.update(timeEntries).set(values).where(eq(timeEntries.id, input.id)).returning();
      await audit(tx, ctx, "time_entry", input.id, "editar", { ...diffOf(before, after), motivo: input.reason });
      revalidateCrew();
      return { id: input.id };
    }
    const [row] = await tx.insert(timeEntries).values({ ...values, source: "manual" }).returning({ id: timeEntries.id });
    await audit(tx, ctx, "time_entry", row!.id, "crear", { motivo: input.reason });
    revalidateCrew();
    return { id: row!.id };
  },
);

// ───────────────────────── Worker app (own data) ─────────────────────────

const geoSchema = { lat: z.number().min(-90).max(90).optional().nullable(), lng: z.number().min(-180).max(180).optional().nullable() };
/** Offline replays may carry the original time; accept up to 72 h back and no more than 5 min ahead. */
const zWhen = z.coerce
  .date()
  .optional()
  .nullable()
  .refine((d) => !d || (d.getTime() <= Date.now() + 5 * 60_000 && d.getTime() >= Date.now() - 72 * 3_600_000), { message: "Hora de fichaje no válida" });

async function myWorker(tx: Tx, userId: string) {
  const w = await findWorkerForUser(tx, userId);
  if (!w) throw new UserError("Tu usuario no está vinculado a una ficha de trabajador. Pide al administrador que lo vincule.");
  return w;
}

export const clockIn = tenantAction(z.object({ shiftId: zId.optional().nullable(), at: zWhen, ...geoSchema }), "fichar", async (input, tx, ctx) => {
  const w = await myWorker(tx, ctx.user.id);
  const [open] = await tx.select().from(timeEntries).where(and(eq(timeEntries.workerId, w.id), isNull(timeEntries.clockOut)));
  if (open) throw new UserError("Ya tienes una entrada abierta. Ficha la salida primero.");
  const [row] = await tx
    .insert(timeEntries)
    .values({ workerId: w.id, shiftId: input.shiftId || null, clockIn: input.at ?? new Date(), latIn: input.lat ?? null, lngIn: input.lng ?? null, source: input.at ? "app_sin_conexion" : "app" })
    .returning({ id: timeEntries.id, clockIn: timeEntries.clockIn });
  await audit(tx, ctx, "time_entry", row!.id, "crear", { entrada: row!.clockIn });
  revalidateCrew();
  return row!;
});

export const clockOut = tenantAction(z.object({ at: zWhen, breakMinutes: z.coerce.number().int().min(0).max(600).default(0), diet: z.boolean().default(false), ...geoSchema }), "fichar", async (input, tx, ctx) => {
  const w = await myWorker(tx, ctx.user.id);
  const [open] = await tx.select().from(timeEntries).where(and(eq(timeEntries.workerId, w.id), isNull(timeEntries.clockOut))).orderBy(desc(timeEntries.clockIn));
  if (!open) throw new UserError("No tienes ninguna entrada abierta.");
  const out = input.at ?? new Date();
  if (out <= open.clockIn) throw new UserError("La salida debe ser posterior a la entrada.");
  await tx.update(timeEntries).set({ clockOut: out, latOut: input.lat ?? null, lngOut: input.lng ?? null, breakMinutes: input.breakMinutes, diet: input.diet }).where(eq(timeEntries.id, open.id));
  await audit(tx, ctx, "time_entry", open.id, "editar", { salida: out });
  revalidateCrew();
  return { id: open.id };
});

export const respondShift = tenantAction(z.object({ shiftId: zId, status: z.enum(["confirmado", "rechazado"]) }), "fichar", async (input, tx, ctx) => {
  const w = await myWorker(tx, ctx.user.id);
  const [a] = await tx
    .update(assignments)
    .set({ status: input.status })
    .where(and(eq(assignments.shiftId, input.shiftId), eq(assignments.workerId, w.id)))
    .returning();
  if (!a) throw new UserError("No estás asignado a este turno.");
  await audit(tx, ctx, "shift", input.shiftId, "estado", { trabajador: w.name, respuesta: input.status });
  revalidateCrew();
  return { status: input.status };
});

export const submitJobReport = tenantAction(
  z.object({
    shiftId: zId,
    clientRef: z.string().min(6).max(80),
    checklist: z.array(z.object({ label: z.string().max(200), done: z.boolean() })).max(50),
    incidents: zOptText(4000),
    clientName: zOptText(120),
    clientSignature: z.string().max(400_000).regex(/^data:image\/png;base64,/).optional().nullable(),
    photos: z.array(z.object({ key: z.string().max(300), stage: z.enum(["inicio", "fin"]) })).max(30),
    complete: z.boolean(),
  }),
  "fichar",
  async (input, tx, ctx) => {
    const w = await myWorker(tx, ctx.user.id);
    const prefix = `${ctx.tenantId}/partes/`;
    if (input.photos.some((p) => !p.key.startsWith(prefix))) throw new UserError("Foto no válida");
    const [existing] = await tx.select().from(jobReports).where(and(eq(jobReports.shiftId, input.shiftId), eq(jobReports.workerId, w.id)));
    const values = {
      checklist: input.checklist,
      incidents: input.incidents,
      clientName: input.clientName,
      clientSignature: input.clientSignature ?? existing?.clientSignature ?? null,
      photos: input.photos,
      completedAt: input.complete ? new Date() : null,
    };
    if (existing) {
      await tx.update(jobReports).set(values).where(eq(jobReports.id, existing.id));
    } else {
      await tx.insert(jobReports).values({ shiftId: input.shiftId, workerId: w.id, clientRef: input.clientRef, ...values }).onConflictDoNothing();
    }
    await audit(tx, ctx, "job_report", input.shiftId, existing ? "editar" : "crear", { completo: input.complete, incidencias: Boolean(input.incidents) });
    revalidateCrew();
    return { ok: true };
  },
);

/** QR lookup shared by the worker app and the warehouse module (any member of the tenant). */
export async function lookupQr(code: string) {
  const ctx = await getAppContext();
  if (!ctx) return { ok: false as const, error: "Sesión caducada" };
  const c = z.string().trim().min(2).max(120).safeParse(code);
  if (!c.success) return { ok: false as const, error: "Código no válido" };
  return withTenant(ctx.tenantId, async (tx) => {
    const [row] = await tx
      .select({ unit: itemUnits, item: { id: items.id, name: items.name, sku: items.sku, category: items.category, location: items.location } })
      .from(itemUnits)
      .innerJoin(items, eq(items.id, itemUnits.itemId))
      .where(eq(itemUnits.qrCode, c.data));
    if (row) return { ok: true as const, kind: "unidad" as const, unit: { id: row.unit.id, serial: row.unit.serial, status: row.unit.status, qrCode: row.unit.qrCode }, item: row.item };
    const [item] = await tx.select({ id: items.id, name: items.name, sku: items.sku, category: items.category, location: items.location }).from(items).where(eq(items.sku, c.data));
    if (item) return { ok: true as const, kind: "articulo" as const, unit: null, item };
    return { ok: false as const, error: `No hay ningún artículo con el código ${c.data}` };
  });
}

export const linkWorkerUser = tenantAction(z.object({ workerId: zId, userId: z.string().min(1).max(80).nullable() }), "personal", async (input, tx, ctx) => {
  if (input.userId) {
    const [taken] = await tx.select({ id: workers.id }).from(workers).where(eq(workers.userId, input.userId));
    if (taken && taken.id !== input.workerId) throw new UserError("Ese usuario ya está vinculado a otra ficha.");
  }
  await tx.update(workers).set({ userId: input.userId }).where(eq(workers.id, input.workerId));
  await audit(tx, ctx, "worker", input.workerId, "editar", { usuario: input.userId });
  revalidateCrew();
  return { ok: true };
});
