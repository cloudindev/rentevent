import { describe, expect, it } from "vitest";
import { phaseTimes, rederivePhases, type OrderDates } from "./order-phases";

const d = (s: string) => new Date(`2026-06-${s}:00Z`);
const before: OrderDates = { load: d("10T08:00"), eventStart: d("11T12:00"), eventEnd: d("12T02:00"), ret: d("13T18:00") };
const after: OrderDates = { load: d("09T08:00"), eventStart: d("11T12:00"), eventEnd: d("12T02:00"), ret: d("14T18:00") };
const asRows = (dates: OrderDates, prefix: string) => phaseTimes(dates).map(([kind, a, b]) => ({ id: `${prefix}-${kind}`, kind, startsAt: a, endsAt: b }));

describe("rederivePhases", () => {
  it("moves the phases generated from the order's previous dates", () => {
    const updates = rederivePhases(asRows(before, "p"), before, after);
    const byId = new Map(updates.map((u) => [u.id, u]));
    expect(byId.get("p-carga")?.startsAt).toEqual(after.load);
    expect(byId.get("p-retorno")?.endsAt).toEqual(after.ret);
    // the event itself did not move
    expect(byId.has("p-evento")).toBe(false);
  });

  it("keeps phases edited by hand and phases of other orders", () => {
    const rows = asRows(before, "p");
    rows[0] = { ...rows[0]!, startsAt: d("10T07:00") }; // carga edited by hand
    const other = asRows({ load: d("20T08:00"), eventStart: d("21T12:00"), eventEnd: d("22T02:00"), ret: d("23T18:00") }, "o");
    const ids = rederivePhases([...rows, ...other], before, after).map((u) => u.id);
    expect(ids).not.toContain("p-carga");
    expect(ids).toContain("p-retorno");
    expect(ids.some((id) => id.startsWith("o-"))).toBe(false);
  });

  it("does nothing when no phase matches", () => {
    expect(rederivePhases([], before, after)).toEqual([]);
  });
});
