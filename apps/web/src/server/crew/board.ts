/** Pure helpers for the planning board layout. */
export type BoardRange = { start: number; end: number; days: { key: string; start: number; end: number; label: string }[] };

const DAY = 86_400_000;

/** Monday-based week (Madrid wall clock approximated through Intl offsets of each day). */
export function weekRange(anchorKey: string, mode: "semana" | "dia"): BoardRange {
  const [y, m, d] = anchorKey.split("-").map(Number) as [number, number, number];
  const anchor = new Date(Date.UTC(y, m - 1, d));
  const dow = (anchor.getUTCDay() + 6) % 7;
  const first = mode === "semana" ? new Date(anchor.getTime() - dow * DAY) : anchor;
  const count = mode === "semana" ? 7 : 1;
  const days = Array.from({ length: count }, (_, i) => {
    const u = new Date(first.getTime() + i * DAY);
    const key = u.toISOString().slice(0, 10);
    const start = madridMidnight(key);
    const end = madridMidnight(new Date(u.getTime() + DAY).toISOString().slice(0, 10));
    const label = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(u);
    return { key, start, end, label };
  });
  return { start: days[0]!.start, end: days[days.length - 1]!.end, days };
}

export function madridMidnight(key: string): number {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  const off = (t: number) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(t);
    const g = (k: string) => Number(p.find((x) => x.type === k)?.value);
    return (Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - t) / 60000;
  };
  const t = guess - off(guess) * 60000;
  return guess - off(t) * 60000;
}

export const shiftKey = (k: string, delta: number) => {
  const [y, m, d] = k.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};

export type HourWindow = { from: number; to: number };
export const WEEK_WINDOW: HourWindow = { from: 6, to: 22 };
export const DAY_WINDOW: HourWindow = { from: 5, to: 23 };

/** Maps an instant to a 0–100 % position, compressing each day to the visible hour window. */
export function timeToPct(t: number, range: Pick<BoardRange, "start" | "end"> & { days?: BoardRange["days"] }, win?: HourWindow): number {
  if (!range.days || !win) return ((Math.min(Math.max(t, range.start), range.end) - range.start) / (range.end - range.start)) * 100;
  const n = range.days.length;
  if (t <= range.start) return 0;
  if (t >= range.end) return 100;
  const i = range.days.findIndex((d) => t >= d.start && t < d.end);
  const d = range.days[i]!;
  const h = (t - d.start) / 3_600_000;
  const frac = Math.min(1, Math.max(0, (h - win.from) / (win.to - win.from)));
  return ((i + frac) / n) * 100;
}

/** Horizontal placement in percent of a block inside the range. */
export function blockPosition(start: number, end: number, range: Pick<BoardRange, "start" | "end"> & { days?: BoardRange["days"] }, win?: HourWindow) {
  const s = Math.max(start, range.start);
  const e = Math.min(end, range.end);
  if (e <= s) return null;
  const left = timeToPct(s, range, win);
  const right = timeToPct(e, range, win);
  return { left, width: Math.max(1.2, right - left) };
}

/**
 * Week view placement: snaps a block to whole day columns (from its first to its
 * last day), so short or early shifts stay readable instead of becoming slivers.
 * `from`/`to` are day indexes usable for lane stacking.
 */
export function dayBlockPosition(start: number, end: number, range: BoardRange) {
  const s = Math.max(start, range.start);
  const e = Math.min(end, range.end);
  if (e <= s) return null;
  const n = range.days.length;
  const idx = (t: number) => Math.max(0, range.days.findIndex((d) => t >= d.start && t < d.end));
  const from = idx(s);
  const to = idx(e - 1) + 1;
  return { left: (from / n) * 100, width: ((to - from) / n) * 100, from, to };
}

/** Assigns lane indexes so overlapping blocks in a row stack instead of overlapping. */
export function stackLanes<T extends { start: number; end: number }>(blocks: T[]): (T & { lane: number })[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const laneEnds: number[] = [];
  return sorted.map((b) => {
    let lane = laneEnds.findIndex((e) => e <= b.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = b.end;
    return { ...b, lane };
  });
}
