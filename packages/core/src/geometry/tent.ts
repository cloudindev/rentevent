import { computeSeating } from "../tent/seating";
import type { BomLine } from "../tent/bom";
import {
  FLOOR_KINDS,
  type BomItem,
  type PartRole,
  type SideType,
  type StructureFamily,
  type TentConfiguration,
} from "../tent/schema";

/**
 * Tent-local frame (metres): x along the length (0 = start front), y up,
 * z across the width centred on the ridge (negative = left side).
 */
export type Vec2 = [number, number];

export type PartShape =
  | { kind: "post"; x: number; z: number; height: number }
  | { kind: "truss"; x: number; profile: Vec2[] }
  | { kind: "purlin"; x0: number; x1: number; z: number; y: number }
  | { kind: "roof"; x0: number; x1: number; profile: Vec2[] }
  | { kind: "wall"; x0: number; x1: number; z: number; height: number }
  | { kind: "gable"; x: number; profile: Vec2[] }
  | { kind: "frontwall"; x: number; z0: number; z1: number; height: number }
  | { kind: "box"; x: number; y: number; z: number; sx: number; sy: number; sz: number; rotation: number }
  | { kind: "cylinder"; x: number; y: number; z: number; radius: number; height: number }
  | { kind: "chair"; x: number; z: number; rotation: number }
  | { kind: "jaima"; size: number; eave: number; ridge: number };

export type PartMaterial = "blanco" | "transparente" | "ventana" | "puerta" | "metal" | "madera" | "suelo" | "moqueta" | "hormigon";

export type TentPart = {
  id: string;
  role: PartRole;
  material: PartMaterial;
  /** units consumed from the BOM for this role (m² for floors) */
  amount: number;
  /** pick target for direct editing in the viewer */
  target?: { type: "roof"; bay: number } | { type: "side"; bay: number; side: "left" | "right" } | { type: "front"; end: "start" | "end" };
  shape: PartShape;
};

/** Cross-section of the truss/roof from left eave to right eave. */
export function roofProfile(family: Pick<StructureFamily, "width" | "eaveHeight" | "ridgeHeight" | "roofShape">): Vec2[] {
  const hw = family.width / 2;
  const e = family.eaveHeight;
  const r = family.ridgeHeight;
  if (family.roofShape === "poligonal") {
    const h = r - e;
    return [
      [-hw, e],
      [-hw * 0.72, e + h * 0.55],
      [-hw * 0.38, e + h * 0.88],
      [0, r],
      [hw * 0.38, e + h * 0.88],
      [hw * 0.72, e + h * 0.55],
      [hw, e],
    ];
  }
  return [
    [-hw, e],
    [0, r],
    [hw, e],
  ];
}

/** Points evenly spaced along a polyline, including both ends. */
export function pointsAlong(profile: Vec2[], count: number): Vec2[] {
  if (count <= 0) return [];
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < profile.length; i++) {
    const [ax, ay] = profile[i - 1]!;
    const [bx, by] = profile[i]!;
    const d = Math.hypot(bx - ax, by - ay);
    segs.push(d);
    total += d;
  }
  if (count === 1) return [profile[Math.floor(profile.length / 2)]!];
  const out: Vec2[] = [];
  for (let k = 0; k < count; k++) {
    let target = (k / (count - 1)) * total;
    let i = 0;
    while (i < segs.length - 1 && target > segs[i]!) {
      target -= segs[i]!;
      i++;
    }
    const [ax, ay] = profile[i]!;
    const [bx, by] = profile[i + 1]!;
    const t = segs[i]! === 0 ? 0 : Math.min(1, target / segs[i]!);
    out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
  }
  return out;
}

const SIDE_ROLE: Record<Exclude<SideType, "abierto">, PartRole> = {
  blanco: "lateral_blanco",
  transparente: "lateral_transparente",
  ventana: "lateral_ventana",
  puerta: "lateral_puerta",
};

export function generateTentParts(config: TentConfiguration, family: StructureFamily): TentPart[] {
  const parts: TentPart[] = [];
  const m = family.moduleLength;
  const L = config.modules * m;
  const W = family.width;
  const hw = W / 2;
  const e = family.eaveHeight;

  if (family.roofShape === "jaima") {
    parts.push({
      id: "jaima",
      role: "jaima",
      material: "blanco",
      amount: 1,
      shape: { kind: "jaima", size: W, eave: e, ridge: family.ridgeHeight },
    });
    return parts;
  }

  const profile = roofProfile(family);
  const porticos = config.modules + 1;
  const pesosPorPata = Math.max(0, Math.round(family.parameters.pesos_por_pata ?? 1));
  const estacasPorPata = Math.max(0, Math.round(family.parameters.estacas_por_pata ?? 2));
  const correasPorTramo = Math.max(0, Math.round(family.parameters.correas_por_tramo ?? 5));
  const weightKg = family.parameters.peso_kg ?? 500;
  const weightSide = Math.cbrt(weightKg / 2400); // concrete block edge

  for (let i = 0; i < porticos; i++) {
    const x = i * m;
    parts.push({ id: `cercha-${i}`, role: "cercha", material: "metal", amount: 1, shape: { kind: "truss", x, profile } });
    for (const z of [-hw, hw]) {
      const side = z < 0 ? "l" : "r";
      parts.push({ id: `pilar-${i}-${side}`, role: "pilar", material: "metal", amount: 1, shape: { kind: "post", x, z, height: e } });
      parts.push({
        id: `placa-${i}-${side}`,
        role: "placa_base",
        material: "metal",
        amount: 1,
        shape: { kind: "box", x, y: 0.01, z, sx: 0.4, sy: 0.02, sz: 0.4, rotation: 0 },
      });
      if (config.anchoring === "pesos") {
        for (let k = 0; k < pesosPorPata; k++) {
          const off = (z < 0 ? -1 : 1) * (0.35 + weightSide / 2);
          parts.push({
            id: `peso-${i}-${side}-${k}`,
            role: "peso",
            material: "hormigon",
            amount: 1,
            shape: { kind: "box", x, y: weightSide / 2 + k * weightSide, z: z + off, sx: weightSide, sy: weightSide, sz: weightSide, rotation: 0 },
          });
        }
      } else {
        for (let k = 0; k < estacasPorPata; k++) {
          const dx = (k - (estacasPorPata - 1) / 2) * 0.3;
          parts.push({
            id: `estaca-${i}-${side}-${k}`,
            role: "estaca",
            material: "metal",
            amount: 1,
            shape: { kind: "cylinder", x: x + dx, y: 0.1, z: z + (z < 0 ? -0.25 : 0.25), radius: 0.025, height: 0.2 },
          });
        }
      }
    }
  }

  const purlinPoints = pointsAlong(profile, correasPorTramo);
  config.bays.slice(0, config.modules).forEach((bay, j) => {
    const x0 = j * m;
    const x1 = x0 + m;
    purlinPoints.forEach(([z, y], k) =>
      parts.push({ id: `correa-${j}-${k}`, role: "correa", material: "metal", amount: 1, shape: { kind: "purlin", x0, x1, z, y } }),
    );
    if (bay.roof !== "ninguno") {
      parts.push({
        id: `techo-${j}`,
        role: bay.roof === "blanco" ? "lona_techo_blanca" : "lona_techo_transparente",
        material: bay.roof,
        amount: 1,
        target: { type: "roof", bay: j },
        shape: { kind: "roof", x0, x1, profile },
      });
    }
    for (const side of ["left", "right"] as const) {
      const t = bay[side];
      if (t === "abierto") continue;
      parts.push({
        id: `lateral-${j}-${side}`,
        role: SIDE_ROLE[t],
        material: t,
        amount: 1,
        target: { type: "side", bay: j, side },
        shape: { kind: "wall", x0, x1, z: side === "left" ? -hw : hw, height: e },
      });
    }
  });

  for (const end of ["start", "end"] as const) {
    const f = config.fronts[end];
    const x = end === "start" ? 0 : L;
    if (f.type === "sin_pico") continue;
    parts.push({ id: `pico-${end}`, role: "pico", material: "blanco", amount: 1, target: { type: "front", end }, shape: { kind: "gable", x, profile } });
    if (f.type === "completo") {
      parts.push({
        id: `frontal-${end}`,
        role: f.material === "blanco" ? "frontal_blanco" : "frontal_transparente",
        material: f.material,
        amount: 1,
        target: { type: "front", end },
        shape: { kind: "frontwall", x, z0: -hw, z1: hw, height: e },
      });
    }
  }

  const FLOOR_STYLE = {
    tarima: { y: 0.1, h: 0.1, material: "madera" },
    suelo: { y: 0.03, h: 0.03, material: "suelo" },
    moqueta: { y: 0.005, h: 0.01, material: "moqueta" },
  } as const;
  let stack = 0;
  for (const kind of FLOOR_KINDS) {
    const f = config.floors[kind];
    if (!f.enabled) continue;
    const st = FLOOR_STYLE[kind];
    const excluded = new Set(f.excludedBays);
    for (let j = 0; j < config.modules; j++) {
      if (excluded.has(j)) continue;
      parts.push({
        id: `${kind}-${j}`,
        role: kind,
        material: st.material,
        amount: m * W,
        shape: { kind: "box", x: j * m + m / 2, y: stack + st.h / 2, z: 0, sx: m, sy: st.h, sz: W, rotation: 0 },
      });
    }
    stack += st.h;
  }

  const stage = config.interior.stage;
  if (stage.enabled) {
    parts.push({
      id: "escenario",
      role: "escenario",
      material: "madera",
      amount: stage.width * stage.depth,
      shape: { kind: "box", x: 1 + stage.depth / 2, y: stack + stage.height / 2, z: 0, sx: stage.depth, sy: stage.height, sz: stage.width, rotation: 0 },
    });
  }

  const seating = computeSeating({ layout: config.interior.layout, length: L, width: W, stage: stage.enabled ? stage : null });
  seating.tables.forEach((t, k) =>
    parts.push({
      id: `mesa-${k}`,
      role: "mesa",
      material: "blanco",
      amount: 1,
      shape:
        t.kind === "redonda"
          ? { kind: "cylinder", x: t.x, y: stack + 0.375, z: t.y, radius: 0.9, height: 0.75 }
          : { kind: "cylinder", x: t.x, y: stack + 0.55, z: t.y, radius: 0.35, height: 1.1 },
    }),
  );
  seating.chairs.forEach((c, k) =>
    parts.push({ id: `silla-${k}`, role: "silla", material: "blanco", amount: 1, shape: { kind: "chair", x: c.x, z: c.y, rotation: c.rotation } }),
  );

  return parts;
}

export type CoverageGap = { role: PartRole; drawn: number; inBom: number };

/**
 * Enforces "nothing drawn that is not in the BOM": a part is drawable only if
 * the BOM holds enough units of an item with the same role.
 */
export function coverPartsWithBom(
  parts: TentPart[],
  lines: BomLine[],
  items: Pick<BomItem, "id" | "role" | "roleAmount">[],
): { drawable: TentPart[]; gaps: CoverageGap[] } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const budget = new Map<PartRole, number>();
  for (const l of lines) {
    const item = byId.get(l.itemId);
    if (item) budget.set(item.role, (budget.get(item.role) ?? 0) + l.quantity * (item.roleAmount ?? 1));
  }
  const used = new Map<PartRole, number>();
  const wanted = new Map<PartRole, number>();
  const drawable: TentPart[] = [];
  for (const p of parts) {
    wanted.set(p.role, (wanted.get(p.role) ?? 0) + p.amount);
    const u = used.get(p.role) ?? 0;
    if (u + p.amount <= (budget.get(p.role) ?? 0) + 1e-6) {
      used.set(p.role, u + p.amount);
      drawable.push(p);
    }
  }
  const gaps: CoverageGap[] = [];
  for (const [role, w] of wanted) {
    const inBom = budget.get(role) ?? 0;
    if (w > inBom + 1e-6) gaps.push({ role, drawn: w, inBom });
  }
  return { drawable, gaps };
}

export function tentFootprint(config: TentConfiguration, family: Pick<StructureFamily, "moduleLength" | "width" | "roofShape">) {
  const length = family.roofShape === "jaima" ? family.width : config.modules * family.moduleLength;
  return { length, width: family.width };
}
