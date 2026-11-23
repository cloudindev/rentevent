import { describe, expect, it } from "vitest";
import { aggregateMaterial, clampCount, compareLocation, containerScanPlan, deliveryNoteNumber, expandContainer, groupByLocation, inspectionDue, labelUrl, lineStatus, listStatus, matchScan, normalizeCode, progress, settleReturn, wouldCycle } from "./logic";

const L = (q: number, p = 0, lo = 0, r = 0, d = 0, x = 0) => ({ quantity: q, prepared: p, loaded: lo, returned: r, damaged: d, lost: x });

describe("pick list statuses", () => {
  it("outgoing lines and lists", () => {
    expect(lineStatus(L(5), "salida")).toBe("por_preparar");
    expect(lineStatus(L(5, 5), "salida")).toBe("preparado");
    expect(lineStatus(L(5, 5, 5), "salida")).toBe("cargado");
    expect(listStatus([L(5, 5), L(2, 2, 2)], "salida")).toBe("preparado");
    expect(listStatus([L(5, 5, 5)], "salida")).toBe("cargado");
    expect(listStatus([L(5, 1)], "salida")).toBe("por_preparar");
    expect(listStatus([], "salida")).toBe("por_preparar");
    expect(listStatus([L(5)], "salida", { closed: true })).toBe("en_obra");
  });
  it("returns: pending, late and back", () => {
    const now = new Date("2026-12-20T10:00:00Z");
    expect(listStatus([L(5, 0, 0, 2)], "retorno", { dueAt: new Date("2026-12-21T00:00:00Z"), now })).toBe("por_volver");
    expect(listStatus([L(5, 0, 0, 2)], "retorno", { dueAt: new Date("2026-12-19T00:00:00Z"), now })).toBe("retrasado");
    expect(listStatus([L(5, 0, 0, 3, 1, 1)], "retorno", { now })).toBe("por_volver");
    expect(lineStatus(L(5, 0, 0, 3, 1, 1), "retorno")).toBe("devuelto");
    expect(listStatus([L(5)], "retorno", { closed: true })).toBe("devuelto");
    expect(lineStatus(L(5), "retorno", true)).toBe("retrasado");
  });
  it("progress", () => {
    expect(progress([], "salida")).toBe(0);
    expect(progress([L(10, 10, 10)], "salida")).toBe(100);
    expect(progress([L(10, 10, 0)], "salida")).toBe(50);
    expect(progress([L(10, 0, 0, 4, 1)], "retorno")).toBe(50);
  });
});

describe("material and locations", () => {
  it("aggregates per item and skips supplements", () => {
    expect(
      aggregateMaterial([
        { itemId: "a", quantity: "2", kind: "articulo" },
        { itemId: "a", quantity: 3, kind: "articulo" },
        { itemId: "b", quantity: 4, kind: "suplemento" },
        { itemId: null, quantity: 1, kind: "transporte" },
        { itemId: "c", quantity: 0, kind: "articulo" },
      ]),
    ).toEqual([{ itemId: "a", quantity: 5 }]);
  });
  it("orders locations naturally and groups by aisle", () => {
    const sorted = ["B-01", "A-10", null, "A-02"].sort(compareLocation);
    expect(sorted).toEqual(["A-02", "A-10", "B-01", null]);
    expect(compareLocation(null, null)).toBe(0);
    const g = groupByLocation([{ location: "B-01" }, { location: "A-02" }, { location: null }, { location: "A-05" }]);
    expect(g.map((x) => [x.location, x.lines.length])).toEqual([["Pasillo A", 2], ["Pasillo B", 1], ["Sin ubicación", 1]]);
  });
});

describe("returns and counters", () => {
  it("settles missing units", () => {
    expect(settleReturn(L(10, 0, 0, 7, 1, 0), false)).toEqual({ returned: 7, damaged: 1, lost: 0, missing: 2 });
    expect(settleReturn(L(10, 0, 0, 7, 1, 0), true)).toEqual({ returned: 7, damaged: 1, lost: 2, missing: 0 });
    expect(clampCount(-1, 5)).toBe(0);
    expect(clampCount(9, 5)).toBe(5);
  });
  it("matches scans by serial QR or SKU", () => {
    const lines = [{ id: "l1", itemId: "i1", sku: "FOC-LED" }, { id: "l2", itemId: "i2", sku: "SIL" }];
    const units = new Map([["RV-FOC-LED-001", { itemId: "i1", serial: "FOC-LED-001" }], ["RV-X-1", { itemId: "zz", serial: "X-1" }]]);
    expect(matchScan("RV-FOC-LED-001", lines, units)).toEqual({ lineId: "l1", serial: "FOC-LED-001" });
    expect(matchScan(" sil ", lines, units)).toEqual({ lineId: "l2", serial: null });
    expect(matchScan("RV-X-1", lines, units)).toBeNull();
    expect(matchScan("nada", lines, units)).toBeNull();
  });
});

describe("inspections", () => {
  const now = new Date("2026-11-19T00:00:00Z");
  it("computes due dates and status", () => {
    expect(inspectionDue(null, null, null, now).status).toBe("sin_plan");
    expect(inspectionDue(365, null, null, now).status).toBe("vencida");
    expect(inspectionDue(180, new Date("2026-05-10T00:00:00Z"), null, now)).toMatchObject({ status: "vencida" });
    expect(inspectionDue(365, new Date("2026-02-15T00:00:00Z"), null, now).status).toBe("ok");
    expect(inspectionDue(60, new Date("2026-10-01T00:00:00Z"), null, now).status).toBe("proxima");
    expect(inspectionDue(365, null, new Date("2026-06-01T00:00:00Z"), now).status).toBe("ok");
  });
  it("numbers delivery notes", () => {
    expect(deliveryNoteNumber(2026, 7)).toBe("ALB-2026-0007");
  });
});

describe("serial tracking", () => {
  it("reads raw codes and label URLs", () => {
    expect(normalizeCode(" RV-MIC-001 ")).toBe("RV-MIC-001");
    expect(normalizeCode("https://rentevent.es/q/RV-MIC-001")).toBe("RV-MIC-001");
    expect(normalizeCode("https://x.rentevent.es/q/RV%20A?x=1")).toBe("RV A");
    expect(labelUrl("https://rentevent.es/", "RV A")).toBe("https://rentevent.es/q/RV%20A");
    expect(normalizeCode(labelUrl("https://rentevent.es", "RV-FC-001"))).toBe("RV-FC-001");
  });

  const U = (id: string, itemId: string, parent: string | null) => ({ id, itemId, serial: id.toUpperCase(), parentUnitId: parent });
  // case → 2 sets → mic + receiver each; batteries as bulk in each set; cables in the case
  const units = [U("fc", "case", null), U("s1", "set", "fc"), U("s2", "set", "fc"), U("m1", "mic", "s1"), U("r1", "rec", "s1"), U("m2", "mic", "s2"), U("r2", "rec", "s2"), U("loose", "mic", null)];
  const contents = [
    { containerUnitId: "s1", itemId: "bat", quantity: 2 },
    { containerUnitId: "s2", itemId: "bat", quantity: 2 },
    { containerUnitId: "fc", itemId: "xlr", quantity: 4 },
  ];

  it("expands nested cases and sets", () => {
    const e = expandContainer("fc", units, contents);
    expect(e.units.map((u) => u.id).sort()).toEqual(["m1", "m2", "r1", "r2", "s1", "s2"]);
    expect(e.bulk.sort((a, b) => a.itemId.localeCompare(b.itemId))).toEqual([
      { itemId: "bat", quantity: 4 },
      { itemId: "xlr", quantity: 4 },
    ]);
    expect(expandContainer("s1", units, contents).units.map((u) => u.id).sort()).toEqual(["m1", "r1"]);
    expect(expandContainer("fc", units, contents, 1).units.map((u) => u.id).sort()).toEqual(["s1", "s2"]);
  });

  it("survives cycles and detects them before packing", () => {
    const loop = [U("a", "case", "b"), U("b", "case", "a")];
    expect(expandContainer("a", loop, []).units.map((u) => u.id)).toEqual(["b"]);
    const parentOf = new Map(units.map((u) => [u.id, u.parentUnitId]));
    expect(wouldCycle("fc", "m1", parentOf)).toBe(true); // putting the case inside its own mic
    expect(wouldCycle("fc", "fc", parentOf)).toBe(true);
    expect(wouldCycle("loose", "s1", parentOf)).toBe(false);
  });

  it("applies a whole case to a pick list, capped per line", () => {
    const line = (id: string, itemId: string, quantity: number, extra: Partial<{ prepared: number; returned: number; damaged: number; scannedUnits: string[] }> = {}) => ({ id, itemId, quantity, prepared: 0, returned: 0, damaged: 0, lost: 0, scannedUnits: [], ...extra });
    const e = expandContainer("fc", units, contents);
    const found = { units: e.units, bulk: e.bulk };
    const plan = containerScanPlan([line("lm", "mic", 2, { prepared: 1, scannedUnits: ["M1"] }), line("lr", "rec", 1), line("lb", "bat", 10)], "salida", found);
    expect(plan.field).toBe("prepared");
    expect(plan.updates.find((u) => u.lineId === "lm")).toEqual({ lineId: "lm", count: 2, serials: ["M1", "M2"] });
    expect(plan.updates.find((u) => u.lineId === "lr")).toEqual({ lineId: "lr", count: 1, serials: ["R1"] });
    expect(plan.updates.find((u) => u.lineId === "lb")?.count).toBe(4);
    expect(plan.added).toBe(1 + 1 + 4);
    expect(plan.skipped).toEqual(
      expect.arrayContaining([
        { itemId: "rec", serial: "R2", reason: "completo" },
        { itemId: "set", serial: "S1", reason: "no_en_lista" },
        { itemId: "xlr", serial: null, reason: "no_en_lista" },
      ]),
    );
    const back = containerScanPlan([line("lm", "mic", 2, { damaged: 1 })], "retorno", { units: [{ itemId: "mic", serial: "M1" }, { itemId: "mic", serial: "M2" }], bulk: [] });
    expect(back.updates[0]).toEqual({ lineId: "lm", count: 1, serials: ["M1"] });
  });
});
