import { describe, expect, it } from "vitest";
import { canDrive, checkAssignment, hasBlockingConflict, shiftNeed, suggestCrew, weekStart, type ShiftInfo, type WorkerInfo } from ".";

const H = 3_600_000;
const T = Date.UTC(2026, 11, 14, 7); // Monday
const worker = (p: Partial<WorkerInfo> = {}): WorkerInfo => ({
  id: "w1",
  name: "Pablo",
  skills: ["montador", "jefe_equipo"],
  trainingExpiresAt: "2027-06-01",
  weeklyHoursLimit: 40,
  unavailable: [],
  ...p,
});
const shift = (id: string, start: number, hours: number, p: Partial<ShiftInfo> = {}): ShiftInfo => ({ id, start, end: start + hours * H, requiredSkills: ["montador"], label: id, ...p });

describe("crew conflicts", () => {
  it("acceptance: overlapping shifts and missing skills are reported before saving", () => {
    const a = shift("a", T, 8);
    const b = shift("b", T + 4 * H, 8, { requiredSkills: ["carretillero"] });
    const c = checkAssignment({ worker: worker(), shift: b, existing: [{ workerId: "w1", shift: a }] });
    expect(c.map((x) => x.code)).toEqual(expect.arrayContaining(["solape", "habilidad"]));
    expect(hasBlockingConflict(c)).toBe(true);
  });

  it("training, rest, weekly hours, availability and driver", () => {
    const w = worker({ trainingExpiresAt: "2026-12-01", unavailable: [{ start: T, end: T + 24 * H, reason: "Vacaciones" }], weeklyHoursLimit: 7 });
    const prev = shift("prev", T - 8 * H, 6);
    const s = shift("s", T + 2 * H, 8, { vehicleLicence: "conductor_c" });
    const codes = checkAssignment({ worker: w, shift: s, existing: [{ workerId: "w1", shift: prev }] }).map((c) => c.code);
    expect(codes).toEqual(expect.arrayContaining(["formacion", "descanso", "horas_semana", "no_disponible", "sin_conductor"]));
    expect(checkAssignment({ worker: worker({ trainingExpiresAt: null }), shift: s, existing: [], crewOnShift: [worker({ id: "d", skills: ["conductor_c"] })] }).map((c) => c.code)).toEqual(["formacion"]);
    const before = shift("before", T + 12 * H, 4);
    expect(checkAssignment({ worker: worker(), shift: shift("x", T, 4), existing: [{ workerId: "w1", shift: before }] }).map((c) => c.code)).toEqual(["descanso"]);
  });

  it("no conflicts for a clean assignment", () => {
    expect(checkAssignment({ worker: worker(), shift: shift("s", T, 8), existing: [] })).toEqual([]);
  });

  it("suggests the best crew", () => {
    const s = shift("s", T, 8, { requiredSkills: ["montador", "jefe_equipo"], location: { lat: 43.36, lng: -5.85 } });
    const busy = worker({ id: "busy", name: "Ocupado" });
    const far = worker({ id: "far", name: "Lejos", home: { lat: 42, lng: -3 } });
    const near = worker({ id: "near", name: "Cerca", home: { lat: 43.37, lng: -5.84 } });
    const novice = worker({ id: "nov", name: "Novato", skills: [] });
    const r = suggestCrew({ shift: s, workers: [busy, far, near, novice], existing: [{ workerId: "busy", shift: shift("o", T + H, 4) }], size: 3 });
    expect(r[0]!.worker.id).toBe("near");
    expect(r.map((x) => x.worker.id)).not.toContain("busy");
    expect(suggestCrew({ shift: s, workers: [busy], existing: [], size: 0 })).toHaveLength(1);
  });

  it("phase needs and week start", () => {
    expect(shiftNeed("evento", 10, 4, 8).people).toBe(0);
    expect(shiftNeed("montaje", 64, 4, 8)).toEqual({ people: 8, requiredSkills: ["jefe_equipo", "montador"] });
    expect(shiftNeed("transporte", 1, 4, 2).requiredSkills).toEqual(["conductor_c"]);
    expect(shiftNeed("carga", 2, 2, 0).people).toBe(2);
    expect(new Date(weekStart(T + 3 * 24 * H)).getUTCDay()).toBe(1);
  });
});

describe("canDrive", () => {
  it("lets a higher licence drive smaller vehicles", () => {
    expect(canDrive(["conductor_ce"], "conductor_b")).toBe(true);
    expect(canDrive(["conductor_ce"], "conductor_c")).toBe(true);
    expect(canDrive(["conductor_c"], "conductor_b")).toBe(true);
    expect(canDrive(["conductor_b"], "conductor_c")).toBe(false);
    expect(canDrive(["conductor_c"], "conductor_ce")).toBe(false);
    expect(canDrive(["montador"], "conductor_b")).toBe(false);
  });
});
