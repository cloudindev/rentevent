import "server-only";
import { dayCells, dayKey } from "@rentevent/core";
import { itemTimeline } from "@rentevent/db/services";
import type { Tx } from "@rentevent/db";
import type { TimelineData } from "@/components/app/item-timeline";

const WD = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short" });
const DM = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" });

/** Builds the per-day timeline for an item, tagging prep (load) and return days. */
export async function buildTimeline(
  tx: Tx,
  itemId: string,
  fromKey: string,
  toKey: string,
  opts: { orderId?: string | null; loadAt?: Date | null; returnAt?: Date | null; quantity?: number; withDates?: boolean } = {},
): Promise<TimelineData> {
  const days = dayCells(fromKey, toKey);
  const t = await itemTimeline(
    tx,
    itemId,
    days,
    opts.orderId ?? null,
    opts.quantity,
    opts.loadAt && opts.returnAt ? { start: opts.loadAt.getTime(), end: opts.returnAt.getTime() } : undefined,
  );
  const loadDay = opts.loadAt ? dayKey(opts.loadAt.getTime()) : null;
  const returnDay = opts.returnAt ? dayKey(opts.returnAt.getTime()) : null;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(".", "");
  return {
    days: days.map((d) => ({
      ...d,
      label: opts.withDates ? DM.format(d.start) : cap(WD.format(d.start)),
      tag: d.day === loadDay ? "prep." : d.day === returnDay ? "devol." : undefined,
    })),
    rows: opts.orderId ? t.rows : t.rows.filter((r) => r.kind !== "este"),
    cells: t.cells.map((c) => ({ day: c.day, available: c.available })),
    total: t.stock.total - t.stock.inRepair,
  };
}
