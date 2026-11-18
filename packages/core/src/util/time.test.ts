import { describe, expect, it } from "vitest";
import { addDays, dayCells, dayKey, daysBetween, zonedTime } from "./time";

describe("Europe/Madrid time helpers", () => {
  it("handles winter and summer offsets", () => {
    expect(new Date(zonedTime(2026, 12, 10, 8, 0)).toISOString()).toBe("2026-12-10T07:00:00.000Z");
    expect(new Date(zonedTime(2026, 7, 10, 8, 0)).toISOString()).toBe("2026-07-10T06:00:00.000Z");
    expect(dayKey(Date.UTC(2026, 11, 31, 23, 30))).toBe("2027-01-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("day cells across the DST change are 23 or 25 hours", () => {
    const cells = dayCells("2026-10-24", "2026-10-26");
    expect(cells.map((c) => (c.end - c.start) / 3_600_000)).toEqual([24, 25, 24]);
    expect(daysBetween(0, 1)).toBe(1);
    expect(daysBetween(0, 3 * 86_400_000)).toBe(3);
  });
});
