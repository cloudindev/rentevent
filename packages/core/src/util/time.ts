export const TZ = "Europe/Madrid";

/** Offset (minutes) of a time zone at a given instant. */
export function tzOffsetMinutes(instant: number, timeZone = TZ): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60000);
}

/** Epoch ms of a wall-clock time in the given zone. */
export function zonedTime(y: number, m: number, d: number, hh = 0, mm = 0, timeZone = TZ): number {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMinutes(guess, timeZone);
  const t = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(t, timeZone);
  return off1 === off2 ? t : guess - off2 * 60000;
}

/** YYYY-MM-DD of an instant in the zone. */
export function dayKey(instant: number, timeZone = TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

export function parseDayKey(key: string): [number, number, number] {
  const [y, m, d] = key.split("-").map(Number);
  return [y!, m!, d!];
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = parseDayKey(key);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Local-day cells covering [from, to] inclusive. */
export function dayCells(fromKey: string, toKey: string, timeZone = TZ): { day: string; start: number; end: number }[] {
  const out: { day: string; start: number; end: number }[] = [];
  let k = fromKey;
  for (let i = 0; i < 400 && k <= toKey; i++) {
    const [y, m, d] = parseDayKey(k);
    const next = addDays(k, 1);
    const [y2, m2, d2] = parseDayKey(next);
    out.push({ day: k, start: zonedTime(y, m, d, 0, 0, timeZone), end: zonedTime(y2, m2, d2, 0, 0, timeZone) });
    k = next;
  }
  return out;
}

export function daysBetween(start: number, end: number): number {
  return Math.max(1, Math.ceil((end - start) / 86_400_000));
}
