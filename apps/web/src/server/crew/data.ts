import "server-only";
import {
  and,
  asc,
  assignments,
  eq,
  gt,
  inArray,
  lt,
  orders,
  projects,
  shifts,
  vehicles,
  workerUnavailability,
  workers,
  type Tx,
} from "@rentevent/db";
import type { ExistingAssignment, ShiftInfo, WorkerInfo } from "@rentevent/core";

export type WorkerRow = typeof workers.$inferSelect;
export type ShiftRow = typeof shifts.$inferSelect;

export function toWorkerInfo(w: WorkerRow, unavailable: (typeof workerUnavailability.$inferSelect)[]): WorkerInfo {
  return {
    id: w.id,
    name: w.name,
    skills: w.skills,
    trainingExpiresAt: w.trainingExpiresAt,
    weeklyHoursLimit: w.weeklyHoursLimit,
    unavailable: unavailable
      .filter((u) => u.workerId === w.id)
      .map((u) => ({ start: u.startsAt.getTime(), end: u.endsAt.getTime(), reason: u.kind === "baja" ? "Baja" : u.kind === "vacaciones" ? "Vacaciones" : (u.note ?? "No disponible") })),
    home: w.homeLat != null && w.homeLng != null ? { lat: w.homeLat, lng: w.homeLng } : null,
    costPerHour: Number(w.costPerHour),
  };
}

export function toShiftInfo(s: ShiftRow, vehicleLicence: string | null, label?: string): ShiftInfo {
  return {
    id: s.id,
    start: s.startsAt.getTime(),
    end: s.endsAt.getTime(),
    requiredSkills: s.requiredSkills,
    vehicleLicence,
    location: s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : null,
    label: label ?? s.title,
  };
}

/** Everything needed to evaluate conflicts around a time window (padded by a week for rest/weekly checks). */
export async function loadCrewWindow(tx: Tx, from: Date, to: Date) {
  const padFrom = new Date(from.getTime() - 8 * 86_400_000);
  const padTo = new Date(to.getTime() + 8 * 86_400_000);
  const [ws, unav, sh, vs] = await Promise.all([
    tx.select().from(workers).where(eq(workers.active, true)).orderBy(asc(workers.name)),
    tx.select().from(workerUnavailability).where(and(lt(workerUnavailability.startsAt, padTo), gt(workerUnavailability.endsAt, padFrom))),
    tx
      .select({ shift: shifts, projectName: projects.name, projectColor: projects.color, orderNumber: orders.number, orderStatus: orders.status })
      .from(shifts)
      .leftJoin(projects, eq(projects.id, shifts.projectId))
      .leftJoin(orders, eq(orders.id, shifts.orderId))
      .where(and(lt(shifts.startsAt, padTo), gt(shifts.endsAt, padFrom)))
      .orderBy(asc(shifts.startsAt)),
    tx.select().from(vehicles),
  ]);
  const shiftIds = sh.map((s) => s.shift.id);
  const asg = shiftIds.length ? await tx.select().from(assignments).where(inArray(assignments.shiftId, shiftIds)) : [];
  const vehicleById = new Map(vs.map((v) => [v.id, v]));
  const licenceOf = (s: ShiftRow) => (s.vehicleId ? (vehicleById.get(s.vehicleId)?.licenceRequired ?? null) : null);
  const infoById = new Map(sh.map((s) => [s.shift.id, toShiftInfo(s.shift, licenceOf(s.shift), s.projectName ? `${s.shift.title}` : s.shift.title)]));
  const existing: ExistingAssignment[] = asg
    .filter((a) => a.status !== "rechazado")
    .map((a) => ({ workerId: a.workerId, shift: infoById.get(a.shiftId)! }))
    .filter((a) => a.shift);
  const workerInfos = ws.map((w) => toWorkerInfo(w, unav));
  return { workers: ws, workerInfos, unavailability: unav, shifts: sh, assignments: asg, vehicles: vs, vehicleById, infoById, existing, licenceOf };
}

export async function findWorkerForUser(tx: Tx, userId: string) {
  const [w] = await tx.select().from(workers).where(eq(workers.userId, userId));
  return w ?? null;
}
