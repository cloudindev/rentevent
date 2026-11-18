import { describe, expect, it } from "vitest";
import { fixtureFamilies, fixtureItems, fixtureRules } from "../fixtures/asturias";
import { computeBom } from "../tent/bom";
import { defaultConfiguration } from "../tent/schema";
import { zonedTime, dayCells } from "../util/time";
import {
  availabilityStatus,
  checkLines,
  computeAvailability,
  dailyBalance,
  peakOverlap,
  type ReservationInput,
  type SubrentalInput,
} from ".";
import { describeMaxLengths, maxLengthByFamily, shortagesFor, suggestAlternatives, transferConfiguration } from "./planning";

const H = 3_600_000;
const D = 24 * H;
const T0 = zonedTime(2026, 12, 10, 8, 0);
const stockOf = (itemId: string) => {
  const it = fixtureItems.find((i) => i.id === itemId)!;
  return { itemId, total: it.stock, inRepair: 0 };
};
const res = (p: Partial<ReservationInput> & Pick<ReservationInput, "itemId" | "quantity" | "start" | "end">): ReservationInput => ({
  id: Math.random().toString(36),
  status: "confirmado",
  projectId: "p",
  projectName: "Proyecto",
  ...p,
});
const fam = (id: string) => fixtureFamilies.find((f) => f.id === id)!;
const catalog = { families: fixtureFamilies, rules: fixtureRules, items: fixtureItems };

describe("peak overlap", () => {
  it("uses the peak, not the sum", () => {
    const iv = [
      { start: 0, end: 10, qty: 5 },
      { start: 10, end: 20, qty: 7 },
      { start: 5, end: 15, qty: 2 },
    ];
    expect(peakOverlap(iv, 0, 20)).toBe(9);
    expect(peakOverlap(iv, 16, 20)).toBe(7);
    expect(peakOverlap([{ start: 0, end: 5, qty: 0 }], 0, 5)).toBe(0);
    expect(peakOverlap([], 0, 5)).toBe(0);
  });
});

describe("availability engine", () => {
  const range = { start: T0, end: T0 + 3 * D };

  it("acceptance: 49 trusses, 30 confirmed elsewhere → a third needing 21 is short by 2 with the culprits", () => {
    const reservations = [
      res({ itemId: "item-c10b", quantity: 18, start: T0 - D, end: T0 + 2 * D, projectId: "a", projectName: "Feria de Muestras" }),
      res({ itemId: "item-c10b", quantity: 12, start: T0, end: T0 + 4 * D, projectId: "b", projectName: "Boda Llanes" }),
    ];
    const [line] = checkLines([{ itemId: "item-c10b", quantity: 21 }], new Map([["item-c10b", stockOf("item-c10b")]]), reservations, [], range);
    expect(line!.available).toBe(19);
    expect(line!.shortage).toBe(2);
    expect(line!.status).toBe("short");
    expect(line!.occupants.map((o) => o.projectName)).toEqual(["Feria de Muestras", "Boda Llanes"]);
  });

  it("acceptance: the shared 10/14 truss reserved for a 14 m tent lowers the 10 m extra variant", () => {
    const c14 = defaultConfiguration(fam("fam-14b"), 4);
    const trussLine = computeBom({ config: c14, family: fam("fam-14b"), rules: fixtureRules, items: fixtureItems }).lines.find(
      (l) => l.itemId === "item-c1014b",
    )!;
    expect(trussLine.quantity).toBe(5);
    const before = computeAvailability(stockOf("item-c1014b"), [], [], range).available;
    const after = computeAvailability(
      stockOf("item-c1014b"),
      [res({ itemId: "item-c1014b", quantity: trussLine.quantity, start: T0, end: T0 + D, projectName: "Carpa 14x20" })],
      [],
      range,
    ).available;
    expect(before).toBe(9);
    expect(after).toBe(4);
    const extraBefore = maxLengthByFamily(catalog, new Map(fixtureItems.map((i) => [i.id, i.stock]))).find((r) => r.familyId === "fam-10e")!;
    const extraAfter = maxLengthByFamily(
      catalog,
      new Map(fixtureItems.map((i) => [i.id, i.id === "item-c1014b" ? after : i.stock])),
    ).find((r) => r.familyId === "fam-10e")!;
    expect(extraBefore.maxModules).toBe(8);
    expect(extraAfter.maxModules).toBe(3);
    expect(extraAfter.limitingItemId).toBe("item-c1014b");
  });

  it("subtracts repairs and adds incoming subrentals only while they overlap", () => {
    const stock = { itemId: "item-c15a", total: 38, inRepair: 3 };
    const reservations = [res({ itemId: "item-c15a", quantity: 30, start: T0, end: T0 + 2 * D })];
    const subs: SubrentalInput[] = [{ id: "s", itemId: "item-c15a", quantity: 5, start: T0, end: T0 + D }];
    const a = computeAvailability(stock, reservations, subs, range);
    // day 2: 38 − 3 − 30 (no subrental) = 5
    expect(a.available).toBe(5);
    const firstDay = computeAvailability(stock, reservations, subs, { start: T0, end: T0 + D });
    expect(firstDay.available).toBe(10);
    expect(firstDay.subrentalIn).toBe(5);
    const onlySub = computeAvailability(stock, [], subs, { start: T0, end: T0 + D });
    expect(onlySub.available).toBe(40);
  });

  it("options reserve until they expire; enquiries only show demand", () => {
    const now = T0 - 2 * D;
    const reservations = [
      res({ itemId: "x", quantity: 4, start: T0, end: T0 + D, status: "opcion", expiresAt: now + H, projectId: "o1" }),
      res({ itemId: "x", quantity: 3, start: T0, end: T0 + D, status: "opcion", expiresAt: now - H, projectId: "o2" }),
      res({ itemId: "x", quantity: 2, start: T0, end: T0 + D, status: "opcion", expiresAt: null, projectId: "o3" }),
      res({ itemId: "x", quantity: 5, start: T0, end: T0 + D, status: "consulta", projectId: "c1" }),
    ];
    const a = computeAvailability({ itemId: "x", total: 10, inRepair: 0 }, reservations, [], range, { now });
    expect(a.available).toBe(4);
    expect(a.peakReserved).toBe(6);
    expect(a.peakFirm).toBe(0);
    expect(a.potentialDemand).toBe(5);
    expect(a.occupants.map((o) => o.projectId)).toEqual(["c1", "o1", "o3"]);
  });

  it("excludes the project being edited and merges its lines", () => {
    const reservations = [
      res({ itemId: "x", quantity: 4, start: T0, end: T0 + D, projectId: "me" }),
      res({ itemId: "x", quantity: 2, start: T0, end: T0 + D, projectId: "other" }),
      res({ itemId: "x", quantity: 1, start: T0 + H, end: T0 + 2 * H, projectId: "other" }),
    ];
    const a = computeAvailability({ itemId: "x", total: 10, inRepair: 0 }, reservations, [], range, { excludeProjectId: "me" });
    expect(a.available).toBe(7);
    expect(a.occupants).toEqual([{ projectId: "other", projectName: "Proyecto", quantity: 2, status: "confirmado" }]);
  });

  describe("edge overlaps: return and load on the same day", () => {
    const stock = { itemId: "x", total: 10, inRepair: 0 };
    const returnAt10 = res({ itemId: "x", quantity: 10, start: T0 - 2 * D, end: zonedTime(2026, 12, 10, 10, 0) });

    it("load after the return frees the stock without margin", () => {
      const load = { start: zonedTime(2026, 12, 10, 10, 0), end: zonedTime(2026, 12, 12, 18, 0) };
      expect(computeAvailability(stock, [returnAt10], [], load).available).toBe(10);
    });
    it("a turnaround margin blocks a load that starts too soon", () => {
      const load = { start: zonedTime(2026, 12, 10, 10, 30), end: zonedTime(2026, 12, 12, 18, 0) };
      expect(computeAvailability(stock, [returnAt10], [], load, { marginMinutes: 60 }).available).toBe(0);
      expect(computeAvailability(stock, [returnAt10], [], load, { marginMinutes: 30 }).available).toBe(10);
    });
    it("a load before the return on the same day is a conflict", () => {
      const load = { start: zonedTime(2026, 12, 10, 8, 0), end: zonedTime(2026, 12, 12, 18, 0) };
      expect(computeAvailability(stock, [returnAt10], [], load).available).toBe(0);
    });
  });

  it("status thresholds", () => {
    expect(availabilityStatus(10, 11)).toBe("short");
    expect(availabilityStatus(10, 10)).toBe("tight");
    expect(availabilityStatus(10, 5)).toBe("ok");
    expect(availabilityStatus(0, 0)).toBe("tight");
  });

  it("checkLines aggregates duplicated items and handles unknown stock", () => {
    const out = checkLines(
      [
        { itemId: "x", quantity: 2 },
        { itemId: "x", quantity: 3 },
      ],
      new Map(),
      [],
      [],
      range,
    );
    expect(out[0]).toMatchObject({ requested: 5, available: 0, shortage: 5 });
  });

  it("daily balance separates this order from other projects", () => {
    const days = dayCells("2026-12-09", "2026-12-13");
    expect(days).toHaveLength(5);
    const reservations = [
      res({ itemId: "item-c10b", quantity: 2, start: zonedTime(2026, 12, 9, 8), end: zonedTime(2026, 12, 11, 20), projectId: "t", projectName: "Teatro" }),
      res({ itemId: "item-c10b", quantity: 12, start: zonedTime(2026, 12, 10, 8), end: zonedTime(2026, 12, 12, 20), projectId: "me" }),
    ];
    const stock = { itemId: "item-c10b", total: 12, inRepair: 0 };
    const cells = dailyBalance(stock, reservations, [], days, { thisProjectId: "me" });
    expect(cells.map((c) => c.available)).toEqual([10, -2, -2, 0, 12]);
    expect(cells.map((c) => c.thisOrder)).toEqual([0, 12, 12, 12, 0]);
    expect(cells.map((c) => c.reserved)).toEqual([2, 2, 2, 0, 0]);
    const noOrder = dailyBalance(stock, reservations, [], days);
    expect(noOrder[1]!.thisOrder).toBe(0);
  });
});

describe("reverse availability and alternatives", () => {
  const full = new Map(fixtureItems.map((i) => [i.id, i.stock]));

  it("max length per family with all stock free", () => {
    const r = maxLengthByFamily(catalog, full);
    const f10 = r.find((x) => x.familyId === "fam-10b")!;
    expect(f10.maxModules).toBe(20);
    expect(f10.label).toBe("10x100");
    expect(f10.limitingItemId).toBeNull();
    const f7 = r.find((x) => x.familyId === "fam-7b")!;
    expect(f7.maxModules).toBe(6);
    expect(r.find((x) => x.familyId === "fam-15a")!.label).toBe("15x120 alta");
    expect(describeMaxLengths(r)).toMatch(/^Puedes montar hasta .+ o .+\.$/);
  });

  it("limits by the scarce item and describes the result", () => {
    const limited = new Map(full);
    limited.set("item-c10b", 8);
    limited.set("item-c15a", 5);
    const r = maxLengthByFamily(catalog, limited, "pesos");
    expect(r.find((x) => x.familyId === "fam-10b")!.label).toBe("10x35");
    expect(r.find((x) => x.familyId === "fam-15a")!.label).toBe("15x20 alta");
    const none = maxLengthByFamily(catalog, new Map());
    expect(none.every((x) => x.maxModules === 0 && x.label === "no disponible")).toBe(true);
    expect(describeMaxLengths(none)).toMatch(/No hay material/);
    expect(describeMaxLengths(r.filter((x) => x.familyId === "fam-10b"))).toBe("Puedes montar hasta 10x35.");
  });

  it("suggests another family, a split, a date shift and a subrental", () => {
    const config = defaultConfiguration(fam("fam-10b"), 6);
    const available = new Map(full);
    available.set("item-c10b", 5);
    const shifted = new Map([
      [-1, new Map(available)],
      [2, new Map(full)],
      [3, new Map(full)],
      [4, new Map(full)],
    ]);
    const alts = suggestAlternatives({ config, family: fam("fam-10b"), catalog, available, shifted });
    const kinds = alts.map((a) => a.kind);
    expect(kinds).toContain("familia");
    expect(kinds).toContain("partir");
    expect(alts.filter((a) => a.kind === "fechas").map((a) => (a as { offsetDays: number }).offsetDays)).toEqual([2, 3]);
    const sub = alts.find((a) => a.kind === "subalquiler")!;
    expect(sub.kind === "subalquiler" && sub.shortages[0]).toMatchObject({ itemId: "item-c10b", missing: 2 });
    const back = suggestAlternatives({ config, family: fam("fam-10b"), catalog, available, shifted: new Map([[-2, new Map(full)]]) });
    expect(back.find((a) => a.kind === "fechas")!.description).toBe("Adelantar 2 días");
  });

  it("returns nothing when there is no shortage", () => {
    expect(suggestAlternatives({ config: defaultConfiguration(fam("fam-10b"), 2), family: fam("fam-10b"), catalog, available: full })).toEqual([]);
    expect(shortagesFor([{ itemId: "a", quantity: 1 }], new Map([["a", 1]]))).toEqual([]);
    expect(transferConfiguration(defaultConfiguration(fam("fam-10b"), 12), fam("fam-10e")).modules).toBe(8);
  });
});
