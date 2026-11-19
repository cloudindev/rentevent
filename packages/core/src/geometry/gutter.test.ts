import { describe, expect, it } from "vitest";
import { cycle, sharedEdge, snap } from "./gutter";
import { tentCorners } from "./plan";

const placed = (id: string, x: number, y: number, rot: number, L: number, W: number) => ({
  id,
  label: id,
  corners: tentCorners({ x, y, rotation: rot }, L, W),
  length: L,
  width: W,
  placement: { x, y, rotation: rot },
});

describe("gutter helpers", () => {
  it("finds the shared side of two adjacent tents", () => {
    const seg = sharedEdge(placed("a", 0, 0, 0, 20, 10), placed("b", 5, 10, 0, 20, 10))!;
    expect(seg).not.toBeNull();
    const len = Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]);
    expect(len).toBeCloseTo(15);
    expect(seg[0][1]).toBeCloseTo(5);
  });
  it("returns null for separated or perpendicular tents", () => {
    expect(sharedEdge(placed("a", 0, 0, 0, 20, 10), placed("b", 0, 30, 0, 20, 10))).toBeNull();
    expect(sharedEdge(placed("a", 0, 0, 0, 20, 10), placed("b", 30, 0, 45, 20, 10))).toBeNull();
  });
  it("snap and cycle", () => {
    expect(snap(1.26, 0.5)).toBe(1.5);
    expect(snap(37, 15)).toBe(30);
    expect(snap(3.3, 0)).toBe(3.3);
    expect(cycle(["a", "b", "c"] as const, "c")).toBe("a");
    expect(cycle(["a", "b"] as const, "a")).toBe("b");
  });
});
