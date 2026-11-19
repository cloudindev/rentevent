import { describe, expect, it } from "vitest";
import { defaultConfiguration, type Composition } from "@rentevent/core";
import { fixtureFamilies, fixtureItems, fixtureRules } from "@rentevent/core/fixtures/asturias";
import { buildScene } from "./scene-data";
import { applyPick } from "./edit";

const fam = fixtureFamilies.find((f) => f.roofShape === "dos_aguas")!;
const comp = (): Composition => ({ tents: [{ id: "t1", label: "", placement: { x: 0, y: 0, rotation: 0 }, config: defaultConfiguration(fam, 4) }], gutters: [] }) as unknown as Composition;
const scene = (c: Composition, editable = true) => buildScene({ composition: c, families: fixtureFamilies, items: fixtureItems, rules: fixtureRules, editable });
const ghosts = (c: Composition, editable = true) => scene(c, editable).meshes.filter((m) => m.ghost);

describe("viewer empty-slot placeholders", () => {
  it("a removed cover can be clicked back through its placeholder", () => {
    let c = comp();
    const roof = { type: "roof", bay: 1 } as const;
    while (c.tents[0]!.config.bays[1]!.roof !== "ninguno") c = applyPick(c, "t1", roof);
    const g = ghosts(c).find((m) => m.target?.type === "roof");
    expect(g?.target).toEqual(roof);
    c = applyPick(c, "t1", g!.target!);
    expect(c.tents[0]!.config.bays[1]!.roof).toBe("blanco");
  });

  it("open sides and fronts without gable keep a placeholder; nothing when not editing", () => {
    const c = comp();
    const t = c.tents[0]!.config;
    t.bays[0]!.left = "abierto";
    t.fronts.start = { ...t.fronts.start, type: "sin_pico" };
    const targets = ghosts(c).map((m) => JSON.stringify(m.target));
    expect(targets).toContain(JSON.stringify({ type: "side", bay: 0, side: "left" }));
    expect(targets).toContain(JSON.stringify({ type: "front", end: "start" }));
    expect(ghosts(c, false)).toHaveLength(0);
  });
});
