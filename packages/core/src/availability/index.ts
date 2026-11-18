/**
 * Stock availability engine.
 *
 * available(item, range) = total − in repair − peak(overlapping reservations − incoming subrentals)
 *
 * The peak of simultaneous occupation inside the range is used, never the sum.
 * Intervals are half-open [start, end + margin): a return at 10:00 plus a
 * 60-minute turnaround margin frees the stock at 11:00.
 */

export type ReservationStatus = "confirmado" | "opcion" | "consulta";

export type ReservationInput = {
  id: string;
  itemId: string;
  quantity: number;
  start: number;
  end: number;
  status: ReservationStatus;
  /** options lapse after this instant */
  expiresAt?: number | null;
  projectId: string;
  projectName: string;
};

export type SubrentalInput = { id: string; itemId: string; quantity: number; start: number; end: number; supplierName?: string };

export type StockInput = { itemId: string; total: number; inRepair: number };

export type AvailabilityOptions = {
  /** turnaround minutes added after every reservation end */
  marginMinutes?: number;
  /** reference time for option expiry */
  now?: number;
  /** ignore reservations belonging to this project (the one being edited) */
  excludeProjectId?: string | null;
};

export type Occupant = { projectId: string; projectName: string; quantity: number; status: ReservationStatus };

export type Availability = {
  itemId: string;
  total: number;
  inRepair: number;
  /** peak units held by confirmed + live options */
  peakReserved: number;
  peakFirm: number;
  /** peak demand from enquiries (not reserving) */
  potentialDemand: number;
  /** subrental units guaranteed during the whole peak */
  subrentalIn: number;
  available: number;
  occupants: Occupant[];
};

export type AvailabilityStatus = "ok" | "tight" | "short";

const MIN = 60_000;

type Interval = { start: number; end: number; qty: number };

function isLive(r: ReservationInput, now: number): boolean {
  if (r.status !== "opcion") return true;
  return r.expiresAt == null || r.expiresAt > now;
}

/** Clips intervals to [from, to) and returns the max of Σ(qty) over time. */
export function peakOverlap(intervals: Interval[], from: number, to: number): number {
  type Ev = { t: number; d: number };
  const events: Ev[] = [];
  for (const iv of intervals) {
    const s = Math.max(iv.start, from);
    const e = Math.min(iv.end, to);
    if (e <= s || iv.qty === 0) continue;
    events.push({ t: s, d: iv.qty }, { t: e, d: -iv.qty });
  }
  // ends before starts at the same instant: half-open intervals
  events.sort((a, b) => a.t - b.t || a.d - b.d);
  let cur = 0;
  let peak = 0;
  for (let i = 0; i < events.length; i++) {
    cur += events[i]!.d;
    const nextT = events[i + 1]?.t;
    if (nextT !== events[i]!.t && cur > peak) peak = cur;
  }
  return peak;
}

/** Minimum over time of (Σ subrentals − Σ reservations), returned as peak net demand. */
function peakNetDemand(reservations: Interval[], subrentals: Interval[], from: number, to: number): { net: number; reserved: number; sub: number } {
  type Ev = { t: number; r: number; s: number };
  const evs: Ev[] = [{ t: from, r: 0, s: 0 }];
  const push = (iv: Interval, kind: "r" | "s") => {
    const s = Math.max(iv.start, from);
    const e = Math.min(iv.end, to);
    if (e <= s || iv.qty === 0) return;
    evs.push({ t: s, r: kind === "r" ? iv.qty : 0, s: kind === "s" ? iv.qty : 0 });
    evs.push({ t: e, r: kind === "r" ? -iv.qty : 0, s: kind === "s" ? -iv.qty : 0 });
  };
  reservations.forEach((r) => push(r, "r"));
  subrentals.forEach((s) => push(s, "s"));
  evs.sort((a, b) => a.t - b.t);
  let r = 0;
  let s = 0;
  let best = { net: 0, reserved: 0, sub: 0 };
  let first = true;
  for (let i = 0; i < evs.length; i++) {
    r += evs[i]!.r;
    s += evs[i]!.s;
    const nextT = evs[i + 1]?.t;
    if (nextT === evs[i]!.t) continue;
    if (evs[i]!.t >= to) break;
    const net = r - s;
    if (first || net > best.net) {
      best = { net, reserved: r, sub: s };
      first = false;
    }
  }
  return best;
}

export function computeAvailability(
  stock: StockInput,
  reservations: ReservationInput[],
  subrentals: SubrentalInput[],
  range: { start: number; end: number },
  options: AvailabilityOptions = {},
): Availability {
  const margin = (options.marginMinutes ?? 0) * MIN;
  const now = options.now ?? Date.now();
  const relevant = reservations.filter(
    (r) =>
      r.itemId === stock.itemId &&
      r.projectId !== options.excludeProjectId &&
      r.start < range.end &&
      r.end + margin > range.start,
  );
  const holding = relevant.filter((r) => r.status !== "consulta" && isLive(r, now));
  const toIv = (r: { start: number; end: number; quantity: number }): Interval => ({ start: r.start, end: r.end + margin, qty: r.quantity });
  const subs = subrentals.filter((s) => s.itemId === stock.itemId && s.start < range.end && s.end > range.start);

  const { net, sub } = peakNetDemand(holding.map(toIv), subs.map((s) => ({ start: s.start, end: s.end, qty: s.quantity })), range.start, range.end);
  const peakReserved = peakOverlap(holding.map(toIv), range.start, range.end);
  const peakFirm = peakOverlap(holding.filter((r) => r.status === "confirmado").map(toIv), range.start, range.end);
  const potentialDemand = peakOverlap(relevant.filter((r) => r.status === "consulta").map(toIv), range.start, range.end);

  const occMap = new Map<string, Occupant>();
  for (const r of relevant) {
    if (r.status === "opcion" && !isLive(r, now)) continue;
    const o = occMap.get(r.projectId);
    if (o) o.quantity = Math.max(o.quantity, r.quantity);
    else occMap.set(r.projectId, { projectId: r.projectId, projectName: r.projectName, quantity: r.quantity, status: r.status });
  }

  return {
    itemId: stock.itemId,
    total: stock.total,
    inRepair: stock.inRepair,
    peakReserved,
    peakFirm,
    potentialDemand,
    subrentalIn: sub,
    available: stock.total - stock.inRepair - net,
    occupants: [...occMap.values()].sort((a, b) => b.quantity - a.quantity),
  };
}

export function availabilityStatus(available: number, requested: number, tightThreshold = 0.1): AvailabilityStatus {
  if (requested > available) return "short";
  if (available - requested <= Math.max(0, Math.floor(available * tightThreshold))) return "tight";
  return "ok";
}

export type LineCheck = {
  itemId: string;
  requested: number;
  available: number;
  shortage: number;
  status: AvailabilityStatus;
  occupants: Occupant[];
};

export function checkLines(
  lines: { itemId: string; quantity: number }[],
  stocks: Map<string, StockInput>,
  reservations: ReservationInput[],
  subrentals: SubrentalInput[],
  range: { start: number; end: number },
  options: AvailabilityOptions = {},
): LineCheck[] {
  const byItem = new Map<string, number>();
  for (const l of lines) byItem.set(l.itemId, (byItem.get(l.itemId) ?? 0) + l.quantity);
  return [...byItem.entries()].map(([itemId, requested]) => {
    const stock = stocks.get(itemId) ?? { itemId, total: 0, inRepair: 0 };
    const a = computeAvailability(stock, reservations, subrentals, range, options);
    return {
      itemId,
      requested,
      available: a.available,
      shortage: Math.max(0, Math.ceil(requested - a.available)),
      status: availabilityStatus(a.available, requested),
      occupants: a.occupants,
    };
  });
}

export type DayCell = { day: string; start: number; end: number; available: number; reserved: number; thisOrder: number; subrental: number };

/**
 * Per-day balance for the item timeline card. Each day uses the worst instant
 * inside it. `thisOrderId` reservations are shown in their own row and are
 * subtracted from the balance.
 */
export function dailyBalance(
  stock: StockInput,
  reservations: ReservationInput[],
  subrentals: SubrentalInput[],
  days: { day: string; start: number; end: number }[],
  options: AvailabilityOptions & { thisProjectId?: string | null } = {},
): DayCell[] {
  return days.map((d) => {
    const all = computeAvailability(stock, reservations, subrentals, d, { ...options, excludeProjectId: null });
    const mine = options.thisProjectId
      ? peakOverlap(
          reservations
            .filter((r) => r.itemId === stock.itemId && r.projectId === options.thisProjectId)
            .map((r) => ({ start: r.start, end: r.end + (options.marginMinutes ?? 0) * MIN, qty: r.quantity })),
          d.start,
          d.end,
        )
      : 0;
    return {
      day: d.day,
      start: d.start,
      end: d.end,
      available: all.available,
      reserved: all.peakReserved - mine,
      thisOrder: mine,
      subrental: all.subrentalIn,
    };
  });
}
