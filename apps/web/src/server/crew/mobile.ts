import "server-only";
import { redirect } from "next/navigation";
import { and, asc, assignments, eq, gte, inArray, items, jobReports, lt, orders, projects, shifts, tentConfigurations, timeEntries, vehicles, venues, withTenant, workers, isNull, desc } from "@rentevent/db";
import { getAppContext, getAuthSession, type AppContext } from "../context";
import { findWorkerForUser } from "./data";

/** Context for the worker app: any authenticated member; worker may be null if the user is not linked. */
export async function mobileContext(): Promise<{ ctx: AppContext; worker: typeof workers.$inferSelect | null }> {
  const s = await getAuthSession();
  if (!s) redirect("/acceso?next=/m");
  const ctx = await getAppContext();
  if (!ctx) redirect("/registro/empresa");
  const worker = await withTenant(ctx.tenantId, (tx) => findWorkerForUser(tx, ctx.user.id));
  return { ctx, worker };
}

export async function myAgenda(tenantId: string, workerId: string, from: Date, to: Date) {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .select({ s: shifts, status: assignments.status, project: projects.name, vehicle: vehicles.name })
      .from(assignments)
      .innerJoin(shifts, eq(shifts.id, assignments.shiftId))
      .leftJoin(projects, eq(projects.id, shifts.projectId))
      .leftJoin(vehicles, eq(vehicles.id, shifts.vehicleId))
      .where(and(eq(assignments.workerId, workerId), eq(shifts.published, true), gte(shifts.endsAt, from), lt(shifts.startsAt, to)))
      .orderBy(asc(shifts.startsAt));
    const ids = rows.map((r) => r.s.id);
    const reports = ids.length ? await tx.select({ shiftId: jobReports.shiftId, completedAt: jobReports.completedAt }).from(jobReports).where(and(inArray(jobReports.shiftId, ids), eq(jobReports.workerId, workerId))) : [];
    const [open] = await tx.select().from(timeEntries).where(and(eq(timeEntries.workerId, workerId), isNull(timeEntries.clockOut)));
    return { rows, reports, open: open ?? null };
  });
}

export async function shiftDetail(tenantId: string, workerId: string | null, shiftId: string) {
  return withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .select({ s: shifts, project: projects, venue: venues, order: orders, vehicle: vehicles })
      .from(shifts)
      .leftJoin(projects, eq(projects.id, shifts.projectId))
      .leftJoin(venues, eq(venues.id, projects.venueId))
      .leftJoin(orders, eq(orders.id, shifts.orderId))
      .leftJoin(vehicles, eq(vehicles.id, shifts.vehicleId))
      .where(eq(shifts.id, shiftId));
    if (!row) return null;
    const crew = await tx.select({ workerId: assignments.workerId, status: assignments.status, name: workers.name, phone: workers.phone }).from(assignments).innerJoin(workers, eq(workers.id, assignments.workerId)).where(eq(assignments.shiftId, shiftId));
    const mine = workerId ? crew.find((c) => c.workerId === workerId) : undefined;
    const configs = row.s.orderId ? await tx.select().from(tentConfigurations).where(eq(tentConfigurations.orderId, row.s.orderId)) : [];
    const itemIds = [...new Set(configs.flatMap((c) => (c.bom as { itemId: string }[]).map((l) => l.itemId)))];
    const its = itemIds.length ? await tx.select({ id: items.id, name: items.name, unit: items.unit, location: items.location }).from(items).where(inArray(items.id, itemIds)) : [];
    const [report] = workerId ? await tx.select().from(jobReports).where(and(eq(jobReports.shiftId, shiftId), eq(jobReports.workerId, workerId))) : [];
    const entries = workerId ? await tx.select().from(timeEntries).where(and(eq(timeEntries.workerId, workerId), eq(timeEntries.shiftId, shiftId))).orderBy(desc(timeEntries.clockIn)) : [];
    return { ...row, crew, mine: mine ?? null, configs, items: its, report: report ?? null, entries };
  });
}

export async function recentEntries(tenantId: string, workerId: string) {
  return withTenant(tenantId, (tx) => tx.select().from(timeEntries).where(eq(timeEntries.workerId, workerId)).orderBy(desc(timeEntries.clockIn)).limit(10));
}
