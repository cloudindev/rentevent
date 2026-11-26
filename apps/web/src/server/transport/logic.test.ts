import { describe, expect, it } from "vitest";
import { canDrive, orderLoads } from "./logic";

describe("canDrive", () => {
  it("accepts higher licences for lower vehicles", () => {
    expect(canDrive(["conductor_b"], "conductor_b")).toBe(true);
    expect(canDrive(["conductor_c"], "conductor_b")).toBe(true);
    expect(canDrive(["conductor_ce"], "conductor_b")).toBe(true);
    expect(canDrive(["conductor_ce"], "conductor_c")).toBe(true);
  });
  it("rejects lower licences for bigger vehicles", () => {
    expect(canDrive(["conductor_b"], "conductor_c")).toBe(false);
    expect(canDrive(["conductor_c"], "conductor_ce")).toBe(false);
    expect(canDrive(["montador"], "conductor_b")).toBe(false);
  });
});

describe("orderLoads", () => {
  it("adds tent totals and the other item lines, without counting tent BOM lines twice", () => {
    const loads = orderLoads(
      [{ orderId: "o1", metrics: { totals: { weightKg: 1000, volumeM3: 10 } } }],
      [
        { orderId: "o1", itemId: "pole", tentConfigId: "t1", kind: "articulo", quantity: 20, weightKg: 30, volumeM3: 0.1 },
        { orderId: "o1", itemId: "chair", tentConfigId: null, kind: "articulo", quantity: "100", weightKg: 4, volumeM3: 0.05 },
        { orderId: "o1", itemId: "gutter", tentConfigId: null, kind: "suplemento", quantity: 5, weightKg: 10, volumeM3: 1 },
        { orderId: "o1", itemId: null, tentConfigId: null, kind: "transporte", quantity: 1, weightKg: null, volumeM3: null },
        { orderId: "o2", itemId: "chair", tentConfigId: null, kind: "articulo", quantity: 10, weightKg: 4, volumeM3: 0.05 },
      ],
    );
    expect(loads.get("o1")).toEqual({ weightKg: 1400, volumeM3: 15 });
    expect(loads.get("o2")).toEqual({ weightKg: 40, volumeM3: 0.5 });
  });
});
