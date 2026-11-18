import type { Composition, Placement, StructureFamily } from "../tent/schema";
import { tentFootprint, type Vec2 } from "./tent";

/**
 * Plan frame (metres, top view): X to the right, Y down the page.
 * A tent's placement is the position of its start-front centre; rotation in
 * degrees turns its length axis clockwise from +X.
 */
export function tentCorners(placement: Placement, length: number, width: number): Vec2[] {
  const r = (placement.rotation * Math.PI) / 180;
  const ux: Vec2 = [Math.cos(r), Math.sin(r)];
  const uz: Vec2 = [-Math.sin(r), Math.cos(r)];
  const hw = width / 2;
  const at = (a: number, b: number): Vec2 => [placement.x + ux[0] * a + uz[0] * b, placement.y + ux[1] * a + uz[1] * b];
  return [at(0, -hw), at(length, -hw), at(length, hw), at(0, hw)];
}

function project(poly: Vec2[], axis: Vec2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const [x, y] of poly) {
    const d = x * axis[0] + y * axis[1];
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/** Penetration depth of two convex polygons (SAT). 0 or negative means no overlap. */
export function overlapDepth(a: Vec2[], b: Vec2[]): number {
  let minOverlap = Infinity;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const axis: Vec2 = [-(q[1] - p[1]) / len, (q[0] - p[0]) / len];
      const [a0, a1] = project(a, axis);
      const [b0, b1] = project(b, axis);
      const o = Math.min(a1, b1) - Math.max(a0, b0);
      if (o <= 0) return o;
      minOverlap = Math.min(minOverlap, o);
    }
  }
  return minOverlap;
}

export type PlacedTent = { id: string; label: string; corners: Vec2[]; length: number; width: number; placement: Placement };

export function placeComposition(composition: Composition, families: Map<string, StructureFamily>): PlacedTent[] {
  return composition.tents.flatMap((t) => {
    const fam = families.get(t.config.familyId);
    if (!fam) return [];
    const { length, width } = tentFootprint(t.config, fam);
    return [{ id: t.id, label: t.label, corners: tentCorners(t.placement, length, width), length, width, placement: t.placement }];
  });
}

/** Pairs of tents that overlap by more than the tolerance (touching is fine). */
export function detectCollisions(placed: PlacedTent[], tolerance = 0.02): { a: string; b: string; depth: number }[] {
  const out: { a: string; b: string; depth: number }[] = [];
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const d = overlapDepth(placed[i]!.corners, placed[j]!.corners);
      if (d > tolerance) out.push({ a: placed[i]!.id, b: placed[j]!.id, depth: Math.round(d * 100) / 100 });
    }
  }
  return out;
}

function edges(poly: Vec2[]): [Vec2, Vec2][] {
  return poly.map((p, i) => [p, poly[(i + 1) % poly.length]!]);
}

/**
 * Finds tents sharing a side (parallel edges, touching within tolerance) and
 * returns the shared length — candidates for a gutter (canalón).
 */
export function findGutterJoins(placed: PlacedTent[], tolerance = 0.1): { a: string; b: string; length: number }[] {
  const out: { a: string; b: string; length: number }[] = [];
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      let best = 0;
      for (const [p0, p1] of edges(placed[i]!.corners)) {
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        if (len === 0) continue;
        const u: Vec2 = [(p1[0] - p0[0]) / len, (p1[1] - p0[1]) / len];
        const n: Vec2 = [-u[1], u[0]];
        for (const [q0, q1] of edges(placed[j]!.corners)) {
          const qlen = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]);
          if (qlen === 0) continue;
          const v: Vec2 = [(q1[0] - q0[0]) / qlen, (q1[1] - q0[1]) / qlen];
          if (Math.abs(u[0] * v[1] - u[1] * v[0]) > 0.01) continue;
          const dist = Math.abs((q0[0] - p0[0]) * n[0] + (q0[1] - p0[1]) * n[1]);
          if (dist > tolerance) continue;
          const t0 = (q0[0] - p0[0]) * u[0] + (q0[1] - p0[1]) * u[1];
          const t1 = (q1[0] - p0[0]) * u[0] + (q1[1] - p0[1]) * u[1];
          const shared = Math.min(len, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1));
          if (shared > best) best = shared;
        }
      }
      if (best > tolerance) out.push({ a: placed[i]!.id, b: placed[j]!.id, length: Math.round(best * 100) / 100 });
    }
  }
  return out;
}

export function compositionBounds(placed: PlacedTent[]) {
  const pts = placed.flatMap((p) => p.corners);
  if (pts.length === 0) return { minX: 0, minY: 0, maxX: 10, maxY: 10 };
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxX: Math.max(...pts.map((p) => p[0])),
    maxY: Math.max(...pts.map((p) => p[1])),
  };
}
