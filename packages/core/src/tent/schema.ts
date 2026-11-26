import { z } from "zod";

export const ROOF_TYPES = ["blanco", "transparente", "ninguno"] as const;
export const SIDE_TYPES = ["blanco", "transparente", "ventana", "puerta", "abierto"] as const;
export const FRONT_TYPES = ["completo", "abierto", "sin_pico"] as const;
export const FRONT_MATERIALS = ["blanco", "transparente"] as const;
export const ANCHORING_TYPES = ["anclaje", "pesos"] as const;
export const ROOF_SHAPES = ["dos_aguas", "poligonal", "jaima"] as const;
export const HEIGHT_CLASSES = ["baja", "alta"] as const;
export const SEATING_LAYOUTS = ["ninguno", "banquete", "teatro", "coctel"] as const;
export const FLOOR_KINDS = ["tarima", "suelo", "moqueta"] as const;

export type RoofType = (typeof ROOF_TYPES)[number];
export type SideType = (typeof SIDE_TYPES)[number];
export type FrontType = (typeof FRONT_TYPES)[number];
export type FrontMaterial = (typeof FRONT_MATERIALS)[number];
export type Anchoring = (typeof ANCHORING_TYPES)[number];
export type RoofShape = (typeof ROOF_SHAPES)[number];
export type HeightClass = (typeof HEIGHT_CLASSES)[number];
export type SeatingLayout = (typeof SEATING_LAYOUTS)[number];
export type FloorKind = (typeof FLOOR_KINDS)[number];

export const ROOF_LABELS: Record<RoofType, string> = {
  blanco: "Blanco",
  transparente: "Transparente",
  ninguno: "Sin techo",
};
export const SIDE_LABELS: Record<SideType, string> = {
  blanco: "Blanco",
  transparente: "Transparente",
  ventana: "Ventana inglesa",
  puerta: "Puerta",
  abierto: "Abierto",
};
export const FRONT_LABELS: Record<FrontType, string> = {
  completo: "Pico completo",
  abierto: "Pico abierto",
  sin_pico: "Sin pico",
};
export const ANCHORING_LABELS: Record<Anchoring, string> = { anclaje: "Anclada al suelo", pesos: "Con pesos" };
export const LAYOUT_LABELS: Record<SeatingLayout, string> = {
  ninguno: "Sin distribución",
  banquete: "Banquete",
  teatro: "Teatro",
  coctel: "Cóctel",
};

export const baySchema = z.object({
  roof: z.enum(ROOF_TYPES),
  left: z.enum(SIDE_TYPES),
  right: z.enum(SIDE_TYPES),
});
export type Bay = z.infer<typeof baySchema>;

export const frontSchema = z.object({
  type: z.enum(FRONT_TYPES),
  material: z.enum(FRONT_MATERIALS),
});
export type Front = z.infer<typeof frontSchema>;

export const floorSchema = z.object({
  enabled: z.boolean(),
  excludedBays: z.array(z.number().int().min(0)).default([]),
});
export type FloorOption = z.infer<typeof floorSchema>;

export const stageSchema = z.object({
  enabled: z.boolean(),
  width: z.number().min(1).max(30),
  depth: z.number().min(1).max(20),
  height: z.number().min(0.2).max(2),
});

export const interiorSchema = z.object({
  layout: z.enum(SEATING_LAYOUTS),
  stage: stageSchema,
});

export const tentConfigurationSchema = z.object({
  version: z.literal(1),
  familyId: z.string().min(1),
  modules: z.number().int().min(1).max(60),
  anchoring: z.enum(ANCHORING_TYPES),
  bays: z.array(baySchema).min(1).max(60),
  fronts: z.object({ start: frontSchema, end: frontSchema }),
  floors: z.object({ tarima: floorSchema, suelo: floorSchema, moqueta: floorSchema }),
  interior: interiorSchema,
});
export type TentConfiguration = z.infer<typeof tentConfigurationSchema>;

export const placementSchema = z.object({
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
});
export type Placement = z.infer<typeof placementSchema>;

export const compositionTentSchema = z.object({
  id: z.string().min(1),
  label: z.string().max(80).default(""),
  config: tentConfigurationSchema,
  placement: placementSchema,
});
export type CompositionTent = z.infer<typeof compositionTentSchema>;

export const gutterSchema = z.object({
  a: z.string(),
  b: z.string(),
  /** joined length in metres */
  length: z.number().min(0),
});
export type Gutter = z.infer<typeof gutterSchema>;

export const compositionSchema = z.object({
  version: z.literal(1),
  tents: z.array(compositionTentSchema).min(1).max(40),
  gutters: z.array(gutterSchema).default([]),
  site: z
    .object({
      imageUrl: z.string().nullable(),
      metresPerPixel: z.number().positive().nullable(),
      offsetX: z.number().default(0),
      offsetY: z.number().default(0),
      rotation: z.number().default(0),
    })
    .nullable()
    .default(null),
});
export type Composition = z.infer<typeof compositionSchema>;

/** Labour ratios (person-minutes) — editable per family. */
export const laborRatiosSchema = z.object({
  minPorPortico: z.number().min(0),
  minPorLonaTecho: z.number().min(0),
  minPorLateral: z.number().min(0),
  minPorFrente: z.number().min(0),
  minPorM2Suelo: z.number().min(0),
  minPorPeso: z.number().min(0),
  factorDesmontaje: z.number().min(0).max(2),
  personasMinimas: z.number().int().min(1),
});
export type LaborRatios = z.infer<typeof laborRatiosSchema>;

export const DEFAULT_LABOR: LaborRatios = {
  minPorPortico: 45,
  minPorLonaTecho: 20,
  minPorLateral: 10,
  minPorFrente: 30,
  minPorM2Suelo: 3,
  minPorPeso: 2,
  factorDesmontaje: 0.6,
  personasMinimas: 4,
};

export const familySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  width: z.number().positive(),
  moduleLength: z.number().positive(),
  eaveHeight: z.number().positive(),
  ridgeHeight: z.number().positive(),
  heightClass: z.enum(HEIGHT_CLASSES),
  roofShape: z.enum(ROOF_SHAPES),
  trussItemId: z.string().nullable(),
  minModules: z.number().int().min(1),
  maxModules: z.number().int().min(1),
  /** manufacturer-dependent quantities, e.g. pesos_por_pata, correas_por_tramo */
  parameters: z.record(z.string(), z.number()),
  labor: laborRatiosSchema,
});
export type StructureFamily = z.infer<typeof familySchema>;

export const BOM_GROUPS = ["estructura", "lonas", "anclaje", "suelos", "interior", "accesorios"] as const;
export type BomGroup = (typeof BOM_GROUPS)[number];
export const BOM_GROUP_LABELS: Record<BomGroup, string> = {
  estructura: "Estructura",
  lonas: "Lonas",
  anclaje: "Anclaje y lastre",
  suelos: "Suelos",
  interior: "Interior",
  accesorios: "Accesorios",
};

export const bomRuleSchema = z.object({
  id: z.string(),
  familyId: z.string(),
  itemId: z.string(),
  formula: z.string().min(1).max(500),
  condition: z.string().max(500).nullable(),
  group: z.enum(BOM_GROUPS),
  sortOrder: z.number().int(),
  note: z.string().nullable(),
});
export type BomRule = z.infer<typeof bomRuleSchema>;

/** Roles tie physical items to drawable 3D parts. */
export const PART_ROLES = [
  "cercha",
  "pilar",
  "placa_base",
  "correa",
  "tensor",
  "lona_techo_blanca",
  "lona_techo_transparente",
  "lateral_blanco",
  "lateral_transparente",
  "lateral_ventana",
  "lateral_puerta",
  "pico",
  "frontal_blanco",
  "frontal_transparente",
  "peso",
  "estaca",
  "tarima",
  "suelo",
  "moqueta",
  "escenario",
  "mesa",
  "silla",
  "canalon",
  "jaima",
  "otro",
] as const;
export type PartRole = (typeof PART_ROLES)[number];

/** Spanish names of the 3D parts (item field "Pieza en el 3D"). */
export const PART_ROLE_LABELS: Record<PartRole, string> = {
  cercha: "Cercha",
  pilar: "Pilar",
  placa_base: "Placa base",
  correa: "Correa",
  tensor: "Tensor",
  lona_techo_blanca: "Lona de techo blanca",
  lona_techo_transparente: "Lona de techo transparente",
  lateral_blanco: "Lateral blanco",
  lateral_transparente: "Lateral transparente",
  lateral_ventana: "Lateral con ventana",
  lateral_puerta: "Lateral con puerta",
  pico: "Pico (frontón)",
  frontal_blanco: "Frontal blanco",
  frontal_transparente: "Frontal transparente",
  peso: "Peso de lastre",
  estaca: "Estaca",
  tarima: "Tarima",
  suelo: "Suelo",
  moqueta: "Moqueta",
  escenario: "Escenario",
  mesa: "Mesa",
  silla: "Silla",
  canalon: "Canalón",
  jaima: "Jaima",
  otro: "Otro (no se dibuja)",
};

/**
 * What `roleAmount` means for the roles where one item unit is not one 3D piece
 * (floors and stage are drawn by m², the gutter by metres). Other roles: one unit = one piece.
 */
export const ROLE_AMOUNT_FIELDS: Partial<Record<PartRole, { label: string; hint: string }>> = {
  tarima: { label: "m² por unidad", hint: "Superficie que cubre cada unidad (p. ej. 2 para un módulo de 2x1 m)" },
  suelo: { label: "m² por unidad", hint: "Superficie que cubre cada unidad" },
  moqueta: { label: "m² por unidad", hint: "Superficie que cubre cada unidad (1 si se cuenta por m²)" },
  escenario: { label: "m² por unidad", hint: "Superficie que cubre cada módulo de escenario" },
  canalon: { label: "Metros por unidad", hint: "Longitud de cada canalón; con 1 se asumen 5 m" },
};

export type BomItem = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  weightKg: number;
  volumeM3: number;
  role: PartRole;
  /** role units covered by one item unit (e.g. a 2 m² stage deck covers 2) */
  roleAmount?: number;
};

export function defaultBays(modules: number, side: SideType = "blanco", roof: RoofType = "blanco"): Bay[] {
  return Array.from({ length: modules }, () => ({ roof, left: side, right: side }));
}

export function defaultConfiguration(family: Pick<StructureFamily, "id" | "minModules" | "roofShape">, modules?: number): TentConfiguration {
  const m = Math.max(family.minModules, modules ?? Math.max(family.minModules, 2));
  const isJaima = family.roofShape === "jaima";
  return {
    version: 1,
    familyId: family.id,
    modules: isJaima ? 1 : m,
    anchoring: "anclaje",
    bays: defaultBays(isJaima ? 1 : m),
    fronts: {
      start: { type: "completo", material: "blanco" },
      end: { type: "completo", material: "blanco" },
    },
    floors: {
      tarima: { enabled: false, excludedBays: [] },
      suelo: { enabled: false, excludedBays: [] },
      moqueta: { enabled: false, excludedBays: [] },
    },
    interior: { layout: "ninguno", stage: { enabled: false, width: 6, depth: 4, height: 0.6 } },
  };
}

/** Changes the module count keeping per-bay choices; new bays copy the last bay. */
export function resizeConfiguration(config: TentConfiguration, modules: number): TentConfiguration {
  const n = Math.max(1, Math.min(60, Math.round(modules)));
  const bays = config.bays.slice(0, n);
  const template = config.bays[config.bays.length - 1] ?? { roof: "blanco", left: "blanco", right: "blanco" };
  while (bays.length < n) bays.push({ ...template });
  const prune = (f: FloorOption): FloorOption => ({ ...f, excludedBays: f.excludedBays.filter((b) => b < n) });
  return {
    ...config,
    modules: n,
    bays,
    floors: { tarima: prune(config.floors.tarima), suelo: prune(config.floors.suelo), moqueta: prune(config.floors.moqueta) },
  };
}

export type ConfigIssue = { path: string; message: string };

/** Semantic validation on top of the Zod shape. */
export function validateConfiguration(config: TentConfiguration, family: StructureFamily): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  if (config.familyId !== family.id) issues.push({ path: "familyId", message: "La configuración no corresponde a la familia" });
  if (config.modules < family.minModules || config.modules > family.maxModules) {
    issues.push({
      path: "modules",
      message: `La familia ${family.name} admite entre ${family.minModules} y ${family.maxModules} módulos`,
    });
  }
  if (config.bays.length !== config.modules) issues.push({ path: "bays", message: "El número de tramos no coincide con los módulos" });
  for (const kind of FLOOR_KINDS) {
    if (config.floors[kind].excludedBays.some((b) => b >= config.modules)) {
      issues.push({ path: `floors.${kind}`, message: "Hay tramos excluidos que no existen" });
    }
  }
  const s = config.interior.stage;
  if (s.enabled && (s.width > family.width || s.depth > config.modules * family.moduleLength)) {
    issues.push({ path: "interior.stage", message: "El escenario no cabe dentro de la carpa" });
  }
  return issues;
}
