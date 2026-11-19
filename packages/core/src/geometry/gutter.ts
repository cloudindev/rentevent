import type { PlacedTent } from "./plan";
import type { Vec2 } from "./tent";

/**
 * Shared edge segment (plan metres) between two placed tents, or null when
 * they do not share a parallel side within the tolerance. Used to draw the
 * gutter (canalón) in the 3D scene and the 2D plan.
 */
export function sharedEdge(a: PlacedTent, b: PlacedTent, tolerance = 0.1): [Vec2, Vec2] | null {
  let best: { len: number; seg: [Vec2, Vec2] } | null = null;
  const edges = (poly: Vec2[]) => poly.map((p, i) => [p, poly[(i + 1) % poly.length]!] as [Vec2, Vec2]);
  for (const [p0, p1] of edges(a.corners)) {
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    if (len === 0) continue;
    const u: Vec2 = [(p1[0] - p0[0]) / len, (p1[1] - p0[1]) / len];
    const n: Vec2 = [-u[1], u[0]];
    for (const [q0, q1] of edges(b.corners)) {
      const qlen = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]);
      if (qlen === 0) continue;
      const v: Vec2 = [(q1[0] - q0[0]) / qlen, (q1[1] - q0[1]) / qlen];
      if (Math.abs(u[0] * v[1] - u[1] * v[0]) > 0.01) continue;
      const dist = Math.abs((q0[0] - p0[0]) * n[0] + (q0[1] - p0[1]) * n[1]);
      if (dist > tolerance) continue;
      const t0 = (q0[0] - p0[0]) * u[0] + (q0[1] - p0[1]) * u[1];
      const t1 = (q1[0] - p0[0]) * u[0] + (q1[1] - p0[1]) * u[1];
      const lo = Math.max(0, Math.min(t0, t1));
      const hi = Math.min(len, Math.max(t0, t1));
      if (hi - lo <= tolerance) continue;
      if (!best || hi - lo > best.len) {
        best = { len: hi - lo, seg: [[p0[0] + u[0] * lo, p0[1] + u[1] * lo], [p0[0] + u[0] * hi, p0[1] + u[1] * hi]] };
      }
    }
  }
  return best?.seg ?? null;
}

/** Snaps a value to a step (e.g. 0.5 m or 15°). */
export const snap = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v);

/** Cycle helpers used by the editors (pure, testable). */
export function cycle<T>(values: readonly T[], current: T): T {
  const i = values.indexOf(current);
  return values[(i + 1) % values.length]!;
}
