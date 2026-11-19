import "server-only";
import { addDays, computeAvailability, dayKey, parseDayKey, zonedTime } from "@rentevent/core";
import { loadAvailabilityInputs, marginMinutes } from "@rentevent/db/services";
import type { Tx } from "@rentevent/db";

export type WeekCell = { week: string; start: number; end: number; reserved: number; option: number; available: number; total: number; pct: number };

/** Weekly peak occupation of the given items (heat map). */
export async function weeklyOccupancy(tx: Tx, itemIds: string[], stocks: Map<string, { total: number; repair: number }>, weeks = 16, from = Date.now()) {
  let monday = dayKey(from);
  const [y, m, d] = parseDayKey(monday);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  monday = addDays(monday, -dow);
  const cells: { week: string; start: number; end: number }[] = [];
  for (let w = 0; w < weeks; w++) {
    const a = addDays(monday, w * 7);
    const b = addDays(a, 7);
    const [ya, ma, da] = parseDayKey(a);
    const [yb, mb, db] = parseDayKey(b);
    cells.push({ week: a, start: zonedTime(ya, ma, da), end: zonedTime(yb, mb, db) });
  }
  const margin = await marginMinutes(tx);
  const inputs = await loadAvailabilityInputs(tx, itemIds, { start: new Date(cells[0]!.start), end: new Date(cells[cells.length - 1]!.end) }, margin);
  const out = new Map<string, WeekCell[]>();
  for (const id of itemIds) {
    const s = stocks.get(id) ?? { total: 0, repair: 0 };
    const stock = { itemId: id, total: s.total, inRepair: s.repair };
    out.set(
      id,
      cells.map((c) => {
        const a = computeAvailability(stock, inputs.reservations, inputs.subrentals, c, { marginMinutes: margin });
        const usable = Math.max(1, s.total - s.repair);
        return { ...c, reserved: a.peakFirm, option: a.peakReserved - a.peakFirm, available: a.available, total: s.total, pct: Math.round((a.peakReserved / usable) * 100) };
      }),
    );
  }
  return { weeks: cells, byItem: out };
}
