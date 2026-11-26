/**
 * Pure transport helpers (no DB, no server-only): who may drive a vehicle and
 * how much an order weighs. Shared by the Transporte page and tests.
 */

export type Licence = "conductor_b" | "conductor_c" | "conductor_ce";

import { canDrive as coreCanDrive } from "@rentevent/core";

/** Same rule as the planning board: a higher licence covers the lower vehicles. */
export const canDrive = (skills: readonly string[], required: Licence): boolean => coreCanDrive(skills, required);

export type Load = { weightKg: number; volumeM3: number };

/**
 * Weight and volume of each order: the tents' own totals (already computed from
 * their bill of materials) plus every other item line (single items, kit contents)
 * at the item's weight and volume. Tent BOM lines are skipped so nothing counts twice;
 * priced supplements are not material.
 */
export function orderLoads(
  configs: { orderId: string; metrics: unknown }[],
  lines: { orderId: string; itemId: string | null; tentConfigId: string | null; kind: string; quantity: number | string; weightKg: number | null; volumeM3: number | null }[],
): Map<string, Load> {
  const load = new Map<string, Load>();
  const add = (orderId: string, w: number, v: number) => {
    const x = load.get(orderId) ?? { weightKg: 0, volumeM3: 0 };
    x.weightKg += w;
    x.volumeM3 += v;
    load.set(orderId, x);
  };
  for (const c of configs) {
    const t = ((c.metrics ?? {}) as { totals?: { weightKg?: number; volumeM3?: number } }).totals ?? {};
    add(c.orderId, Number(t.weightKg) || 0, Number(t.volumeM3) || 0);
  }
  for (const l of lines) {
    if (!l.itemId || l.tentConfigId || l.kind === "suplemento") continue;
    const q = Number(l.quantity) || 0;
    add(l.orderId, q * (l.weightKg ?? 0), q * (l.volumeM3 ?? 0));
  }
  for (const x of load.values()) {
    x.weightKg = Math.round(x.weightKg * 10) / 10;
    x.volumeM3 = Math.round(x.volumeM3 * 100) / 100;
  }
  return load;
}
