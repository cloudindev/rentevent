"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, asc, eq, files, inArray, isNull, not, or, orders, projectPhases, projects, tasks, venues } from "@rentevent/db";
import { deleteObject } from "@/lib/adapters/storage";
import { canCollaborate } from "@/lib/permissions";
import { audit, diffOf } from "../audit";
import { tenantAction, UserError } from "../action";
import { nextCounter } from "../numbering";
import { loadWorkLines } from "../orders";
import { persistLines } from "../order-persist";

const H = 3_600_000;

export const createProject = tenantAction(
  z.object({ name: z.string().trim().min(2, "Obligatorio").max(120), clientId: z.string().uuid().nullable(), venueId: z.string().uuid().nullable(), startsAt: z.coerce.date(), endsAt: z.coerce.date(), description: z.string().max(2000).nullable() }).refine((d) => d.startsAt < d.endsAt, { message: "La fecha de fin debe ser posterior", path: ["endsAt"] }),
  "comercial",
  async (input, tx, ctx) => {
    const n = await nextCounter(tx, "proyecto");
    const [v] = input.venueId ? await tx.select().from(venues).where(eq(venues.id, input.venueId)) : [undefined];
    const [p] = await tx
      .insert(projects)
      .values({ number: `P-${new Date().getFullYear()}-${String(n).padStart(3, "0")}`, name: input.name, clientId: input.clientId, venueId: input.venueId, startsAt: input.startsAt, endsAt: input.endsAt, description: input.description, lat: v?.lat ?? null, lng: v?.lng ?? null, locationAddress: v?.address ?? null, managerId: ctx.user.id })
      .returning({ id: projects.id });
    const s = input.startsAt.getTime();
    const e = input.endsAt.getTime();
    const span = e - s;
    const phases: [string, number, number][] = [
      ["carga", s, s + 2 * H],
      ["transporte", s + 2 * H, s + 4 * H],
      ["montaje", s + 4 * H, s + Math.max(6 * H, span * 0.3)],
      ["evento", s + span * 0.35, s + span * 0.75],
      ["desmontaje", s + span * 0.78, e - 3 * H],
      ["retorno", e - 3 * H, e],
    ];
    for (const [kind, a, b] of phases) await tx.insert(projectPhases).values({ projectId: p!.id, kind, startsAt: new Date(a), endsAt: new Date(Math.max(b, a + H)) });
    await audit(tx, ctx, "project", p!.id, "crear");
    revalidatePath("/app/proyectos");
    return { id: p!.id };
  },
);

export const updateProject = tenantAction(
  z.object({ id: z.string().uuid(), name: z.string().trim().min(2).max(120), clientId: z.string().uuid().nullable(), venueId: z.string().uuid().nullable(), description: z.string().max(2000).nullable(), color: z.string().max(20).nullable() }),
  "comercial",
  async (input, tx, ctx) => {
    const [p] = await tx.select().from(projects).where(eq(projects.id, input.id)).for("update");
    if (!p) throw new UserError("Proyecto no encontrado");
    const venueChanged = p.venueId !== input.venueId;
    const [v] = venueChanged && input.venueId ? await tx.select().from(venues).where(eq(venues.id, input.venueId)) : [undefined];
    await tx
      .update(projects)
      .set({ name: input.name, clientId: input.clientId, venueId: input.venueId, description: input.description, color: input.color, ...(venueChanged ? { lat: v?.lat ?? null, lng: v?.lng ?? null, locationAddress: v?.address ?? null, distanceKm: null } : {}) })
      .where(eq(projects.id, input.id));
    // open orders that had the project's previous client (or none) follow the new one
    if (p.clientId !== input.clientId) {
      await tx
        .update(orders)
        .set({ clientId: input.clientId })
        .where(and(eq(orders.projectId, input.id), not(inArray(orders.status, ["devuelto", "cancelado"])), p.clientId ? or(eq(orders.clientId, p.clientId), isNull(orders.clientId)) : isNull(orders.clientId)));
    }
    await audit(tx, ctx, "project", input.id, "editar", diffOf({ name: p.name, clientId: p.clientId, venueId: p.venueId, description: p.description }, { name: input.name, clientId: input.clientId, venueId: input.venueId, description: input.description }));
    revalidatePath(`/app/proyectos/${input.id}`);
    revalidatePath("/app/proyectos");
    return { id: input.id };
  },
);

export const savePhase = tenantAction(
  z.object({ id: z.string().uuid(), startsAt: z.coerce.date(), endsAt: z.coerce.date(), notes: z.string().max(500).nullable() }).refine((d) => d.startsAt < d.endsAt, { message: "El fin debe ser posterior al inicio", path: ["endsAt"] }),
  "comercial",
  async (input, tx, ctx) => {
    const [ph] = await tx.update(projectPhases).set({ startsAt: input.startsAt, endsAt: input.endsAt, notes: input.notes }).where(eq(projectPhases.id, input.id)).returning();
    if (!ph) throw new UserError("Fase no encontrada");
    await audit(tx, ctx, "project", ph.projectId, "editar", { fase: ph.kind });
    revalidatePath(`/app/proyectos/${ph.projectId}`);
    return { id: ph.id };
  },
);

export const addTask = tenantAction(z.object({ projectId: z.string().uuid(), title: z.string().trim().min(1).max(200), dueAt: z.coerce.date().nullable() }), "ver", async (input, tx, ctx) => {
  if (!canCollaborate(ctx.role)) throw new UserError("No tienes permiso para gestionar tareas.");
  await tx.insert(tasks).values({ projectId: input.projectId, title: input.title, dueAt: input.dueAt, assigneeId: ctx.user.id });
  revalidatePath(`/app/proyectos/${input.projectId}`);
  return { ok: true };
});

export const toggleTask = tenantAction(z.object({ id: z.string().uuid(), done: z.boolean() }), "ver", async ({ id, done }, tx, ctx) => {
  if (!canCollaborate(ctx.role)) throw new UserError("No tienes permiso para gestionar tareas.");
  const [t] = await tx.update(tasks).set({ done }).where(eq(tasks.id, id)).returning();
  if (t?.projectId) revalidatePath(`/app/proyectos/${t.projectId}`);
  return { ok: true };
});

export const deleteTask = tenantAction(z.object({ id: z.string().uuid() }), "ver", async ({ id }, tx, ctx) => {
  if (!canCollaborate(ctx.role)) throw new UserError("No tienes permiso para gestionar tareas.");
  const [t] = await tx.delete(tasks).where(eq(tasks.id, id)).returning();
  if (t?.projectId) revalidatePath(`/app/proyectos/${t.projectId}`);
  return { ok: true };
});

export const deleteFile = tenantAction(z.object({ id: z.string().uuid() }), "comercial", async ({ id }, tx, ctx) => {
  const [f] = await tx.delete(files).where(eq(files.id, id)).returning();
  if (f) {
    await deleteObject(f.key).catch(() => undefined);
    await audit(tx, ctx, f.entity, f.entityId, "borrar", { archivo: f.name });
    revalidatePath(`/app/proyectos/${f.entityId}`);
  }
  return { ok: true };
});

/** Recurring events: copies the project, its phases and orders shifted to a new start date (orders as drafts). */
export const duplicateProject = tenantAction(z.object({ id: z.string().uuid(), newStart: z.coerce.date(), name: z.string().trim().min(2).max(120) }), "comercial", async (input, tx, ctx) => {
  const [p] = await tx.select().from(projects).where(eq(projects.id, input.id));
  if (!p || !p.startsAt) throw new UserError("Proyecto no encontrado o sin fechas");
  const shift = input.newStart.getTime() - p.startsAt.getTime();
  const mv = (d: Date | null) => (d ? new Date(d.getTime() + shift) : null);
  const n = await nextCounter(tx, "proyecto");
  const [copy] = await tx
    .insert(projects)
    .values({ number: `P-${input.newStart.getFullYear()}-${String(n).padStart(3, "0")}`, name: input.name, clientId: p.clientId, venueId: p.venueId, locationAddress: p.locationAddress, lat: p.lat, lng: p.lng, distanceKm: p.distanceKm, status: "consulta", startsAt: mv(p.startsAt), endsAt: mv(p.endsAt), managerId: ctx.user.id, color: p.color, description: p.description, recurringOfId: p.id })
    .returning({ id: projects.id });
  const phases = await tx.select().from(projectPhases).where(eq(projectPhases.projectId, p.id));
  for (const ph of phases) await tx.insert(projectPhases).values({ projectId: copy!.id, kind: ph.kind, startsAt: mv(ph.startsAt)!, endsAt: mv(ph.endsAt)!, notes: ph.notes });
  const os = await tx.select().from(orders).where(eq(orders.projectId, p.id)).orderBy(asc(orders.number));
  for (const o of os) {
    if (o.status === "cancelado") continue;
    const number = String(await nextCounter(tx, "pedido"));
    const [no] = await tx
      .insert(orders)
      .values({ projectId: copy!.id, number, title: o.title, status: "borrador", clientId: o.clientId, periodStart: mv(o.periodStart)!, periodEnd: mv(o.periodEnd)!, eventStart: mv(o.eventStart), eventEnd: mv(o.eventEnd), discountPct: o.discountPct, holiday: o.holiday, trips: o.trips, notes: o.notes })
      .returning({ id: orders.id });
    const lines = (await loadWorkLines(tx, o.id)).map((l) => (l.kind === "carpa" ? { ...l, tentConfigId: null } : l));
    await persistLines(tx, no!.id, lines);
  }
  await audit(tx, ctx, "project", copy!.id, "crear", { recurrenteDe: p.number });
  revalidatePath("/app/proyectos");
  return { id: copy!.id };
});
