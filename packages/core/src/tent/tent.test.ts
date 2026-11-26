import { describe, expect, it } from "vitest";
import { fixtureFamilies, fixtureGutter, fixtureItems, fixtureRules, fixtureVehicles } from "../fixtures/asturias";
import { computeBom, mergeBomLines, vehiclesFor } from "./bom";
import { computeCompositionBom, gutterFromItems } from "./composition";
import { computeSeating } from "./seating";
import {
  compositionSchema,
  defaultConfiguration,
  resizeConfiguration,
  tentConfigurationSchema,
  validateConfiguration,
  type TentConfiguration,
} from "./schema";
import { computeVariables, variableNamesFor } from "./variables";
import { coverPartsWithBom, generateTentParts, pointsAlong, roofProfile } from "../geometry/tent";
import { validateFormula } from "../expr";

const fam = (id: string) => {
  const f = fixtureFamilies.find((x) => x.id === id)!;
  // the acceptance criterion asks for a polygonal 15 m tent: keep that variant covered
  return id === "fam-15b-pol" ? { ...fixtureFamilies.find((x) => x.id === "fam-15b")!, id, roofShape: "poligonal" as const } : f;
};
const qty = (lines: { itemId: string; quantity: number }[], itemId: string) => lines.find((l) => l.itemId === itemId)?.quantity ?? 0;
const testRules = [...fixtureRules, ...fixtureRules.filter((r) => r.familyId === "fam-15b").map((r) => ({ ...r, id: `${r.id}-pol`, familyId: "fam-15b-pol" }))];
const bom = (config: TentConfiguration) =>
  computeBom({ config, family: fam(config.familyId), rules: testRules, items: fixtureItems, vehicles: fixtureVehicles });

/** Acceptance: 15x30 polygonal with weights, two complete fronts, transparent sides in three bays, last bay without roof. */
function acceptanceConfig(): TentConfiguration {
  let c = defaultConfiguration(fam("fam-15b-pol"), 6);
  c = { ...c, anchoring: "pesos" };
  c.bays = c.bays.map((b, i) => ({
    roof: i === 5 ? "ninguno" : "blanco",
    left: i < 3 ? "transparente" : "blanco",
    right: i < 3 ? "transparente" : "blanco",
  }));
  return c;
}

describe("tent configuration", () => {
  it("validates with zod and semantic checks", () => {
    const c = defaultConfiguration(fam("fam-10b"), 4);
    expect(tentConfigurationSchema.parse(c)).toEqual(c);
    expect(validateConfiguration(c, fam("fam-10b"))).toEqual([]);
    const bad = { ...c, modules: 30, familyId: "x", floors: { ...c.floors, tarima: { enabled: true, excludedBays: [40] } } };
    const issues = validateConfiguration(bad, fam("fam-10b"));
    expect(issues.map((i) => i.path)).toEqual(expect.arrayContaining(["familyId", "modules", "bays", "floors.tarima"]));
    const stage = { ...c, interior: { layout: "teatro" as const, stage: { enabled: true, width: 30, depth: 4, height: 0.6 } } };
    expect(validateConfiguration(stage, fam("fam-10b")).map((i) => i.path)).toContain("interior.stage");
  });

  it("resizes keeping per-bay choices", () => {
    const c = defaultConfiguration(fam("fam-10b"), 2);
    c.bays[1] = { roof: "transparente", left: "ventana", right: "abierto" };
    c.floors.tarima = { enabled: true, excludedBays: [1] };
    const bigger = resizeConfiguration(c, 4);
    expect(bigger.bays).toHaveLength(4);
    expect(bigger.bays[3]).toEqual({ roof: "transparente", left: "ventana", right: "abierto" });
    const smaller = resizeConfiguration(bigger, 1);
    expect(smaller.floors.tarima.excludedBays).toEqual([]);
    expect(resizeConfiguration({ ...c, bays: [] }, 1).bays[0]).toEqual({ roof: "blanco", left: "blanco", right: "blanco" });
  });

  it("a jaima has a single module and no porticos", () => {
    const c = defaultConfiguration(fam("fam-jaima"), 5);
    expect(c.modules).toBe(1);
    expect(computeVariables(c, fam("fam-jaima")).porticos).toBe(0);
    const r = bom(c);
    expect(qty(r.lines, "item-jaima")).toBe(1);
    expect(qty(r.lines, "item-estaca")).toBe(8);
  });
});

describe("BOM engine", () => {
  it("10x20 uses 5 trusses of 10 m (porticos = largo / módulo + 1)", () => {
    const r = bom(defaultConfiguration(fam("fam-10b"), 4));
    expect(r.metrics.largo).toBe(20);
    expect(qty(r.lines, "item-c10b")).toBe(5);
    expect(qty(r.lines, "item-pilar-baja")).toBe(10);
    expect(qty(r.lines, "item-techo-10-blanco")).toBe(4);
    expect(qty(r.lines, "item-lat-b-blanco")).toBe(8);
    expect(qty(r.lines, "item-pico-10")).toBe(2);
    expect(qty(r.lines, "item-estaca")).toBe(20);
    expect(qty(r.lines, "item-peso-500")).toBe(0);
    expect(r.errors).toEqual([]);
  });

  it("acceptance: 15x30 polygonal with weights, fronts, transparent sides and an open-roof bay", () => {
    const c = acceptanceConfig();
    const r = bom(c);
    expect(fam("fam-15b-pol").roofShape).toBe("poligonal");
    expect(r.metrics).toMatchObject({ largo: 30, ancho: 15, superficie: 450, perimetro: 90 });
    expect(qty(r.lines, "item-c15b")).toBe(7);
    expect(qty(r.lines, "item-techo-15-blanco")).toBe(5);
    expect(qty(r.lines, "item-techo-15-transparente")).toBe(0);
    expect(qty(r.lines, "item-lat-b-trans")).toBe(6);
    expect(qty(r.lines, "item-lat-b-blanco")).toBe(6);
    expect(qty(r.lines, "item-pico-15")).toBe(2);
    expect(qty(r.lines, "item-frontal-15-baja-blanco")).toBe(2);
    expect(qty(r.lines, "item-peso-500")).toBe(7 * 2 * 2);
    expect(qty(r.lines, "item-estaca")).toBe(0);
    expect(r.totals.weightKg).toBeGreaterThan(14000);
    expect(r.vehicles[0]!.count).toBeGreaterThanOrEqual(1);
    expect(r.labor.montajeHoras).toBeGreaterThan(0);
    expect(r.labor.desmontajeHoras).toBeLessThan(r.labor.montajeHoras);
    expect(r.metrics.aforo.coctel).toBe(562);

    // 3D coherence: every drawn part is backed by the BOM
    const parts = generateTentParts(c, fam("fam-15b-pol"));
    const cover = coverPartsWithBom(parts, r.lines, fixtureItems);
    expect(cover.gaps).toEqual([]);
    expect(cover.drawable).toHaveLength(parts.length);
    expect(parts.filter((p) => p.role === "cercha")).toHaveLength(7);
    expect(parts.filter((p) => p.role === "lona_techo_blanca")).toHaveLength(5);
    expect(parts.filter((p) => p.role === "lateral_transparente")).toHaveLength(6);
    expect(parts.filter((p) => p.role === "peso")).toHaveLength(28);
  });

  it("excludes floor bays and computes interior furniture", () => {
    const c = defaultConfiguration(fam("fam-15a"), 4);
    c.floors.tarima = { enabled: true, excludedBays: [0] };
    c.floors.moqueta = { enabled: true, excludedBays: [] };
    c.interior = { layout: "banquete", stage: { enabled: true, width: 6, depth: 4, height: 0.6 } };
    const r = bom(c);
    expect(qty(r.lines, "item-tarima")).toBe(225);
    expect(qty(r.lines, "item-moqueta")).toBe(300);
    expect(qty(r.lines, "item-escenario")).toBe(12);
    expect(qty(r.lines, "item-silla")).toBe(qty(r.lines, "item-mesa-redonda") * 10);
    expect(r.metrics.plazas).toBeGreaterThan(0);
    const cover = coverPartsWithBom(generateTentParts(c, fam("fam-15a")), r.lines, fixtureItems);
    expect(cover.gaps).toEqual([]);
  });

  it("windows, doors, transparent fronts and open fronts", () => {
    const c = defaultConfiguration(fam("fam-20a"), 3);
    c.bays[0] = { roof: "transparente", left: "ventana", right: "puerta" };
    c.fronts = { start: { type: "completo", material: "transparente" }, end: { type: "sin_pico", material: "blanco" } };
    const r = bom(c);
    expect(qty(r.lines, "item-lat-a-vent")).toBe(1);
    expect(qty(r.lines, "item-lat-a-puerta")).toBe(1);
    expect(qty(r.lines, "item-techo-20-transparente")).toBe(1);
    expect(qty(r.lines, "item-frontal-20-alta-transparente")).toBe(1);
    expect(qty(r.lines, "item-pico-20")).toBe(1);
    const open = { ...c, fronts: { start: { type: "abierto" as const, material: "blanco" as const }, end: c.fronts.end } };
    expect(qty(bom(open).lines, "item-frontal-20-alta-transparente")).toBe(0);
    expect(qty(bom(open).lines, "item-pico-20")).toBe(1);
  });

  it("collects formula errors without breaking the BOM", () => {
    const f = fam("fam-10b");
    const rules = [
      { id: "r1", familyId: f.id, itemId: "item-c10b", formula: "porticos", condition: null, group: "estructura" as const, sortOrder: 1, note: null },
      { id: "r2", familyId: f.id, itemId: "item-c10b", formula: "1", condition: null, group: "estructura" as const, sortOrder: 2, note: null },
      { id: "r3", familyId: f.id, itemId: "item-placa", formula: "noexiste * 2", condition: null, group: "estructura" as const, sortOrder: 3, note: null },
      { id: "r4", familyId: f.id, itemId: "item-tarima", formula: "0.333", condition: null, group: "suelos" as const, sortOrder: 4, note: null },
      { id: "r5", familyId: f.id, itemId: "item-tarima", formula: "0.333", condition: null, group: "suelos" as const, sortOrder: 5, note: null },
      { id: "r6", familyId: f.id, itemId: "item-unknown", formula: "1.2", condition: null, group: "accesorios" as const, sortOrder: 6, note: null },
      { id: "r7", familyId: f.id, itemId: "item-unknown2", formula: "-3", condition: null, group: "accesorios" as const, sortOrder: 7, note: null },
    ];
    const r = computeBom({ config: defaultConfiguration(f, 2), family: f, rules, items: fixtureItems });
    expect(qty(r.lines, "item-c10b")).toBe(4);
    expect(r.lines.find((l) => l.itemId === "item-c10b")!.ruleIds).toEqual(["r1", "r2"]);
    expect(qty(r.lines, "item-tarima")).toBe(0.66);
    expect(qty(r.lines, "item-unknown")).toBe(2);
    expect(qty(r.lines, "item-unknown2")).toBe(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ ruleId: "r3" });
    expect(r.vehicles).toEqual([]);
  });

  it("every fixture formula is valid for its family", () => {
    for (const rule of fixtureRules) {
      const f = fam(rule.familyId);
      expect(validateFormula(rule.formula, variableNamesFor(f)).ok, rule.formula).toBe(true);
      if (rule.condition) expect(validateFormula(rule.condition, variableNamesFor(f)).ok).toBe(true);
    }
  });

  it("every family/length combination draws only what the BOM contains", () => {
    for (const f of fixtureFamilies) {
      for (const m of [f.minModules, f.maxModules]) {
        for (const anchoring of ["anclaje", "pesos"] as const) {
          const c = { ...defaultConfiguration(f, m), anchoring };
          const parts = generateTentParts(c, f);
          expect(coverPartsWithBom(parts, bom(c).lines, fixtureItems).gaps, `${f.id} ${m}`).toEqual([]);
        }
      }
    }
  });

  it("vehicles and merge helpers", () => {
    expect(vehiclesFor(0, 0, fixtureVehicles).every((v) => v.count === 0)).toBe(true);
    expect(vehiclesFor(2000, 1, [{ id: "a", name: "A", maxPayloadKg: 1000, volumeM3: 10 }])[0]!.count).toBe(2);
    expect(vehiclesFor(1, 1, [{ id: "a", name: "A", maxPayloadKg: 0, volumeM3: 10 }])).toEqual([]);
    const merged = mergeBomLines([
      [{ itemId: "a", quantity: 1, group: "estructura", ruleIds: ["x"] }],
      [{ itemId: "a", quantity: 2.5, group: "estructura", ruleIds: ["x", "y"] }],
    ]);
    expect(merged).toEqual([{ itemId: "a", quantity: 3.5, group: "estructura", ruleIds: ["x", "y"] }]);
  });
});

describe("geometry", () => {
  it("builds two-pitch and polygonal profiles", () => {
    expect(roofProfile(fam("fam-10b"))).toHaveLength(3);
    expect(roofProfile(fam("fam-15a"))).toHaveLength(3);
    expect(roofProfile(fam("fam-15b-pol"))).toHaveLength(7);
    const pts = pointsAlong(roofProfile(fam("fam-10b")), 5);
    expect(pts).toHaveLength(5);
    expect(pts[2]![0]).toBeCloseTo(0);
    expect(pointsAlong([[0, 0], [0, 0]], 2)).toHaveLength(2);
    expect(pointsAlong(roofProfile(fam("fam-10b")), 1)).toHaveLength(1);
    expect(pointsAlong(roofProfile(fam("fam-10b")), 0)).toEqual([]);
  });

  it("hides parts the BOM does not cover and reports the gap", () => {
    const c = defaultConfiguration(fam("fam-10b"), 2);
    const parts = generateTentParts(c, fam("fam-10b"));
    const lines = bom(c).lines.filter((l) => l.itemId !== "item-c10b");
    const cover = coverPartsWithBom(parts, lines, fixtureItems);
    expect(cover.drawable.some((p) => p.role === "cercha")).toBe(false);
    expect(cover.gaps).toEqual([{ role: "cercha", drawn: 3, inBom: 0 }]);
  });
});

describe("seating", () => {
  it("returns nothing for tiny or empty layouts", () => {
    expect(computeSeating({ layout: "ninguno", length: 20, width: 10, stage: null }).seats).toBe(0);
    expect(computeSeating({ layout: "banquete", length: 1.5, width: 10, stage: null }).seats).toBe(0);
  });
  it("theatre and cocktail layouts", () => {
    const t = computeSeating({ layout: "teatro", length: 20, width: 10, stage: { enabled: true, width: 6, depth: 4 } });
    expect(t.sillas).toBeGreaterThan(100);
    expect(t.chairs.every((ch) => ch.x > 5.5)).toBe(true);
    const k = computeSeating({ layout: "coctel", length: 20, width: 10, stage: null });
    expect(k.standing).toBe(180);
    expect(k.mesasAltas).toBe(18);
  });
});

describe("compositions", () => {
  it("derives the gutter unit length from the canalón item", () => {
    expect(gutterFromItems(fixtureItems)).toEqual(fixtureGutter);
    expect(gutterFromItems([{ id: "g", role: "canalon", roleAmount: 6 }])).toEqual({ itemId: "g", unitLength: 6 });
    // roleAmount left at its default (1) means the standard 5 m piece
    expect(gutterFromItems([{ id: "g", role: "canalon", roleAmount: 1 }])).toEqual({ itemId: "g", unitLength: 5 });
    expect(gutterFromItems([{ id: "g", role: "canalon" }])).toEqual({ itemId: "g", unitLength: 5 });
    expect(gutterFromItems([{ id: "x", role: "otro" }])).toBeNull();
  });

  it("sums tents, gutters and detects collisions", () => {
    const a = defaultConfiguration(fam("fam-10b"), 4);
    const b = defaultConfiguration(fam("fam-10b"), 4);
    const j = defaultConfiguration(fam("fam-jaima"));
    const composition = compositionSchema.parse({
      version: 1,
      tents: [
        { id: "a", label: "A", config: a, placement: { x: 0, y: 0, rotation: 0 } },
        { id: "b", label: "B", config: b, placement: { x: 0, y: 10, rotation: 0 } },
        { id: "j", label: "J", config: j, placement: { x: 5, y: 2, rotation: 0 } },
      ],
      gutters: [{ a: "a", b: "b", length: 20 }],
    });
    const r = computeCompositionBom({ composition, families: fixtureFamilies, rules: fixtureRules, items: fixtureItems, gutter: fixtureGutter });
    expect(qty(r.lines, "item-c10b")).toBe(10);
    expect(qty(r.lines, "item-canalon")).toBe(4);
    expect(qty(r.lines, "item-jaima")).toBe(1);
    expect(r.gutterCandidates).toContainEqual({ a: "a", b: "b", length: 20 });
    expect(r.collisions.map((c) => [c.a, c.b])).toContainEqual(["a", "j"]);
    expect(r.totals.superficie).toBe(425);
    const missing = computeCompositionBom({
      composition: { ...composition, tents: [{ ...composition.tents[0]!, config: { ...a, familyId: "nope" } }] },
      families: fixtureFamilies,
      rules: fixtureRules,
      items: fixtureItems,
    });
    expect(missing.missingFamilies).toEqual(["nope"]);
  });
});
