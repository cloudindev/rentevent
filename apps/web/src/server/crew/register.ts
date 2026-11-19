import "server-only";
import { and, asc, assignments, eq, gte, lt, shifts, timeEntries, workers, type Tx } from "@rentevent/db";
import { aggregateDays } from "./hours";
import { madridMidnight } from "./board";

export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const from = madridMidnight(`${y}-${String(m).padStart(2, "0")}-01`);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const to = madridMidnight(`${ny}-${String(nm).padStart(2, "0")}-01`);
  return { from: new Date(from), to: new Date(to) };
}

/** Planned (assigned, non-rejected shifts) vs real (clock entries) for a month. */
export async function loadRegister(tx: Tx, month: string) {
  const { from, to } = monthBounds(month);
  const [ws, entries, planned] = await Promise.all([
    tx.select().from(workers).orderBy(asc(workers.name)),
    tx.select().from(timeEntries).where(and(gte(timeEntries.clockIn, from), lt(timeEntries.clockIn, to))).orderBy(asc(timeEntries.clockIn)),
    tx
      .select({ workerId: assignments.workerId, status: assignments.status, start: shifts.startsAt, end: shifts.endsAt })
      .from(assignments)
      .innerJoin(shifts, eq(shifts.id, assignments.shiftId))
      .where(and(gte(shifts.startsAt, from), lt(shifts.startsAt, to))),
  ]);
  const rows = aggregateDays(
    entries.map((e) => ({ workerId: e.workerId, clockIn: e.clockIn, clockOut: e.clockOut, breakMinutes: e.breakMinutes, diet: e.diet })),
    planned.filter((p) => p.status !== "rechazado").map((p) => ({ workerId: p.workerId, start: p.start, end: p.end })),
  );
  return { workers: ws, entries, rows, from, to };
}
