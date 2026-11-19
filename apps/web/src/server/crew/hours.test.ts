import { describe, expect, it } from "vitest";
import { aggregateDays, payrollCsv, trainingStatus, workedHours } from "./hours";
import { buildIcs, icsToken, verifyIcsToken } from "./ics";
import { blockPosition, madridMidnight, shiftKey, stackLanes, weekRange } from "./board";

const d = (s: string) => new Date(s);

describe("hours", () => {
  it("computes worked hours minus breaks and open entries", () => {
    expect(workedHours({ clockIn: d("2026-12-10T07:00:00Z"), clockOut: d("2026-12-10T17:00:00Z"), breakMinutes: 60 })).toBe(9);
    expect(workedHours({ clockIn: d("2026-12-10T07:00:00Z"), clockOut: null, breakMinutes: 0 }, d("2026-12-10T09:30:00Z"))).toBe(2.5);
    expect(workedHours({ clockIn: d("2026-12-10T07:00:00Z"), clockOut: d("2026-12-10T07:10:00Z"), breakMinutes: 30 })).toBe(0);
  });
  it("aggregates planned vs real with overtime and diets", () => {
    const rows = aggregateDays(
      [
        { workerId: "a", clockIn: d("2026-12-10T07:00:00Z"), clockOut: d("2026-12-10T18:00:00Z"), breakMinutes: 60, diet: true },
        { workerId: "a", clockIn: d("2026-12-11T07:00:00Z"), clockOut: null, breakMinutes: 0, diet: false },
      ],
      [{ workerId: "a", start: d("2026-12-10T07:00:00Z"), end: d("2026-12-10T15:00:00Z") }],
      d("2026-12-11T09:00:00Z"),
    );
    expect(rows[0]).toEqual({ workerId: "a", day: "2026-12-10", planned: 8, real: 10, overtime: 2, diets: 1, open: false });
    expect(rows[1]).toMatchObject({ day: "2026-12-11", real: 2, open: true });
    const csv = payrollCsv(rows, new Map([["a", "Ana; López"]]));
    expect(csv.startsWith("\uFEFFTrabajador;Fecha")).toBe(true);
    expect(csv).toContain('"Ana; López";2026-12-10;8,00;10,00;2,00;1');
    expect(csv).toContain("Totales");
  });
  it("training status", () => {
    const today = d("2026-11-19T10:00:00Z");
    expect(trainingStatus(null, today)).toBe("sin_formacion");
    expect(trainingStatus("2026-11-01", today)).toBe("caducada");
    expect(trainingStatus("2026-12-10", today)).toBe("proxima");
    expect(trainingStatus("2027-06-01", today)).toBe("vigente");
  });
});

describe("ics", () => {
  it("signs and verifies tokens", () => {
    const t = icsToken("worker-1", "s3cret");
    expect(verifyIcsToken(t, "s3cret")).toBe("worker-1");
    expect(verifyIcsToken(t, "other")).toBeNull();
    expect(verifyIcsToken("nodot", "s3cret")).toBeNull();
    expect(verifyIcsToken(t + "x", "s3cret")).toBeNull();
  });
  it("builds a valid calendar with escaping and folding", () => {
    const ics = buildIcs("Planning, Ana", [{ uid: "s1", start: d("2026-12-10T07:00:00Z"), end: d("2026-12-10T15:00:00Z"), summary: "Montaje; carpa 10x20", location: "Plaza Mayor", description: "x".repeat(200) }], d("2026-11-19T00:00:00Z"));
    expect(ics).toContain("DTSTART:20261210T070000Z");
    expect(ics).toContain("SUMMARY:Montaje\\; carpa 10x20");
    expect(ics).toContain("X-WR-CALNAME:Planning\\, Ana");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});

describe("board", () => {
  it("builds Monday-based weeks and single days", () => {
    const w = weekRange("2026-12-10", "semana");
    expect(w.days).toHaveLength(7);
    expect(w.days[0]!.key).toBe("2026-12-07");
    expect(new Date(w.days[0]!.start).toISOString()).toBe("2026-12-06T23:00:00.000Z");
    expect(weekRange("2026-12-10", "dia").days).toHaveLength(1);
    expect(new Date(madridMidnight("2026-07-01")).toISOString()).toBe("2026-06-30T22:00:00.000Z");
    expect(shiftKey("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("positions and stacks blocks", () => {
    expect(blockPosition(0, 50, { start: 0, end: 100 })).toEqual({ left: 0, width: 50 });
    expect(blockPosition(200, 300, { start: 0, end: 100 })).toBeNull();
    const w = weekRange("2026-12-07", "semana");
    const d0 = w.days[0]!.start;
    // 06:00–14:00 on Monday is the first half of Monday's 16 h window
    const p = blockPosition(d0 + 6 * 3_600_000, d0 + 14 * 3_600_000, w, { from: 6, to: 22 })!;
    expect(p.left).toBeCloseTo(0);
    expect(p.width).toBeCloseTo(50 / 7);
    const lanes = stackLanes([
      { start: 0, end: 10 },
      { start: 5, end: 15 },
      { start: 10, end: 20 },
    ]);
    expect(lanes.map((l) => l.lane)).toEqual([0, 1, 0]);
  });
});
