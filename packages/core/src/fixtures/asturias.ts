/**
 * Catalogue of the first customer (tent company in Asturias).
 *
 * Truss stock and satellite stock are real figures supplied by the customer.
 * Per-portico hardware quantities, weights, volumes, prices and labour ratios
 * are EXAMPLE VALUES pending validation by the company (see DECISIONS.md);
 * they are editable from the UI (Carpas › Asistente de fabricante).
 */
import { DEFAULT_LABOR, type BomGroup, type BomItem, type BomRule, type PartRole, type StructureFamily } from "../tent/schema";
import type { VehicleType } from "../tent/bom";

export type FixtureItem = BomItem & {
  category: string;
  stock: number;
  kind: "granel" | "seriado" | "consumible" | "servicio";
  price: number;
  priceMode: "unidad" | "dia" | "periodo" | "m2" | "incluido";
  /** units of the role covered by one unit (e.g. a 2 m² stage deck) */
  roleAmount?: number;
  pendingValidation?: boolean;
};

const items: FixtureItem[] = [];
const add = (i: Omit<FixtureItem, "volumeM3"> & { volumeM3?: number }) => {
  items.push({ volumeM3: 0.01, ...i });
  return i.id;
};

// Trusses (real stock)
const TRUSS = {
  C7B: add({ id: "item-c7b", sku: "C7B", name: "Cercha 7 m pata baja", unit: "ud", weightKg: 120, volumeM3: 0.4, role: "cercha", category: "Cerchas", stock: 7, kind: "granel", price: 0, priceMode: "incluido" }),
  C10B: add({ id: "item-c10b", sku: "C10B", name: "Cercha 10 m pata baja", unit: "ud", weightKg: 180, volumeM3: 0.6, role: "cercha", category: "Cerchas", stock: 49, kind: "granel", price: 0, priceMode: "incluido" }),
  C1014B: add({ id: "item-c1014b", sku: "C10/14B", name: "Cercha 10/14 m pata baja", unit: "ud", weightKg: 230, volumeM3: 0.8, role: "cercha", category: "Cerchas", stock: 9, kind: "granel", price: 0, priceMode: "incluido" }),
  C15A: add({ id: "item-c15a", sku: "C15A", name: "Cercha 15 m pata alta", unit: "ud", weightKg: 290, volumeM3: 1.0, role: "cercha", category: "Cerchas", stock: 38, kind: "granel", price: 0, priceMode: "incluido" }),
  C15B: add({ id: "item-c15b", sku: "C15B", name: "Cercha 15 m pata baja", unit: "ud", weightKg: 270, volumeM3: 0.95, role: "cercha", category: "Cerchas", stock: 32, kind: "granel", price: 0, priceMode: "incluido" }),
  C20A: add({ id: "item-c20a", sku: "C20A", name: "Cercha 20 m pata alta", unit: "ud", weightKg: 420, volumeM3: 1.4, role: "cercha", category: "Cerchas", stock: 20, kind: "granel", price: 0, priceMode: "incluido" }),
};

const P = { pendingValidation: true } as const;
const HW = {
  pilarBaja: add({ id: "item-pilar-baja", sku: "PIL-B", name: "Pilar pata baja", unit: "ud", weightKg: 35, volumeM3: 0.05, role: "pilar", category: "Estructura", stock: 400, kind: "granel", price: 0, priceMode: "incluido", ...P }),
  pilarAlta: add({ id: "item-pilar-alta", sku: "PIL-A", name: "Pilar pata alta", unit: "ud", weightKg: 52, volumeM3: 0.07, role: "pilar", category: "Estructura", stock: 200, kind: "granel", price: 0, priceMode: "incluido", ...P }),
  placa: add({ id: "item-placa", sku: "PLB", name: "Placa base", unit: "ud", weightKg: 12, volumeM3: 0.01, role: "placa_base", category: "Estructura", stock: 600, kind: "granel", price: 0, priceMode: "incluido", ...P }),
  correa: add({ id: "item-correa", sku: "COR-5", name: "Correa 5 m", unit: "ud", weightKg: 14, volumeM3: 0.02, role: "correa", category: "Estructura", stock: 1600, kind: "granel", price: 0, priceMode: "incluido", ...P }),
  tensor: add({ id: "item-tensor", sku: "TEN", name: "Tensor de arriostramiento", unit: "ud", weightKg: 4, volumeM3: 0.005, role: "tensor", category: "Estructura", stock: 400, kind: "granel", price: 0, priceMode: "incluido", ...P }),
  peso: add({ id: "item-peso-500", sku: "PES-500", name: "Peso de hormigón 500 kg", unit: "ud", weightKg: 500, volumeM3: 0.21, role: "peso", category: "Lastre", stock: 400, kind: "granel", price: 6, priceMode: "unidad", ...P }),
  estaca: add({ id: "item-estaca", sku: "EST", name: "Estaca de anclaje", unit: "ud", weightKg: 3, volumeM3: 0.002, role: "estaca", category: "Anclaje", stock: 2000, kind: "granel", price: 0, priceMode: "incluido", ...P }),
  canalon: add({ id: "item-canalon", sku: "CAN-5", name: "Canalón de unión 5 m", unit: "ud", weightKg: 18, volumeM3: 0.04, role: "canalon", category: "Accesorios", stock: 60, kind: "granel", price: 25, priceMode: "unidad", roleAmount: 5, ...P }),
};

const sides = {
  baja: {
    blanco: add({ id: "item-lat-b-blanco", sku: "LAT-B-BL", name: "Lateral 5 m pata baja blanco", unit: "ud", weightKg: 14, volumeM3: 0.04, role: "lateral_blanco", category: "Lonas", stock: 220, kind: "granel", price: 0, priceMode: "incluido", ...P }),
    transparente: add({ id: "item-lat-b-trans", sku: "LAT-B-TR", name: "Lateral 5 m pata baja transparente", unit: "ud", weightKg: 16, volumeM3: 0.04, role: "lateral_transparente", category: "Lonas", stock: 80, kind: "granel", price: 18, priceMode: "unidad", ...P }),
    ventana: add({ id: "item-lat-b-vent", sku: "LAT-B-VE", name: "Lateral 5 m pata baja ventana inglesa", unit: "ud", weightKg: 15, volumeM3: 0.04, role: "lateral_ventana", category: "Lonas", stock: 60, kind: "granel", price: 15, priceMode: "unidad", ...P }),
    puerta: add({ id: "item-lat-b-puerta", sku: "LAT-B-PU", name: "Lateral 5 m pata baja con puerta", unit: "ud", weightKg: 15, volumeM3: 0.04, role: "lateral_puerta", category: "Lonas", stock: 24, kind: "granel", price: 10, priceMode: "unidad", ...P }),
  },
  alta: {
    blanco: add({ id: "item-lat-a-blanco", sku: "LAT-A-BL", name: "Lateral 5 m pata alta blanco", unit: "ud", weightKg: 20, volumeM3: 0.05, role: "lateral_blanco", category: "Lonas", stock: 140, kind: "granel", price: 0, priceMode: "incluido", ...P }),
    transparente: add({ id: "item-lat-a-trans", sku: "LAT-A-TR", name: "Lateral 5 m pata alta transparente", unit: "ud", weightKg: 23, volumeM3: 0.05, role: "lateral_transparente", category: "Lonas", stock: 50, kind: "granel", price: 24, priceMode: "unidad", ...P }),
    ventana: add({ id: "item-lat-a-vent", sku: "LAT-A-VE", name: "Lateral 5 m pata alta ventana inglesa", unit: "ud", weightKg: 21, volumeM3: 0.05, role: "lateral_ventana", category: "Lonas", stock: 40, kind: "granel", price: 20, priceMode: "unidad", ...P }),
    puerta: add({ id: "item-lat-a-puerta", sku: "LAT-A-PU", name: "Lateral 5 m pata alta con puerta", unit: "ud", weightKg: 21, volumeM3: 0.05, role: "lateral_puerta", category: "Lonas", stock: 12, kind: "granel", price: 14, priceMode: "unidad", ...P }),
  },
};

const roofStock: Record<number, [number, number]> = { 7: [20, 6], 10: [70, 14], 14: [12, 4], 15: [80, 12], 20: [26, 6] };
const roof = (w: number, m: "blanco" | "transparente") =>
  add({
    id: `item-techo-${w}-${m}`,
    sku: `TEC-${w}-${m === "blanco" ? "BL" : "TR"}`,
    name: `Lona de techo ${w}x5 ${m}`,
    unit: "ud",
    weightKg: w * 6,
    volumeM3: w * 0.012,
    role: m === "blanco" ? "lona_techo_blanca" : "lona_techo_transparente",
    category: "Lonas",
    stock: roofStock[w]![m === "blanco" ? 0 : 1],
    kind: "granel",
    price: m === "blanco" ? 0 : w * 4,
    priceMode: m === "blanco" ? "incluido" : "unidad",
    ...P,
  });
const pico = (w: number) =>
  add({ id: `item-pico-${w}`, sku: `PIC-${w}`, name: `Pico de frente ${w} m`, unit: "ud", weightKg: w * 3, volumeM3: w * 0.006, role: "pico", category: "Lonas", stock: w === 10 ? 30 : 16, kind: "granel", price: 0, priceMode: "incluido", ...P });
const frontal = (w: number, h: "baja" | "alta", m: "blanco" | "transparente") =>
  add({
    id: `item-frontal-${w}-${h}-${m}`,
    sku: `FRO-${w}${h === "alta" ? "A" : "B"}-${m === "blanco" ? "BL" : "TR"}`,
    name: `Frontal ${w} m pata ${h} ${m}`,
    unit: "ud",
    weightKg: w * 4,
    volumeM3: w * 0.008,
    role: m === "blanco" ? "frontal_blanco" : "frontal_transparente",
    category: "Lonas",
    stock: m === "blanco" ? 14 : 6,
    kind: "granel",
    price: m === "blanco" ? 0 : w * 6,
    priceMode: m === "blanco" ? "incluido" : "unidad",
    ...P,
  });

const SAT = {
  jaima: add({ id: "item-jaima", sku: "JAI-5", name: "Jaima 5x5", unit: "ud", weightKg: 260, volumeM3: 1.2, role: "jaima", category: "Jaimas", stock: 36, kind: "granel", price: 220, priceMode: "unidad" }),
  suelo: add({ id: "item-suelo", sku: "SUE", name: "Suelo modular", unit: "m2", weightKg: 9, volumeM3: 0.02, role: "suelo", category: "Suelos", stock: 850, kind: "granel", price: 6, priceMode: "m2" }),
  fenolico: add({ id: "item-suelo-fenolico", sku: "SUE-FEN", name: "Suelo fenólico", unit: "m2", weightKg: 12, volumeM3: 0.02, role: "suelo", category: "Suelos", stock: 600, kind: "granel", price: 7.5, priceMode: "m2" }),
  tarima: add({ id: "item-tarima", sku: "TAR", name: "Tarima", unit: "m2", weightKg: 22, volumeM3: 0.12, role: "tarima", category: "Suelos", stock: 500, kind: "granel", price: 12, priceMode: "m2" }),
  moqueta: add({ id: "item-moqueta", sku: "MOQ", name: "Moqueta ferial", unit: "m2", weightKg: 0.6, volumeM3: 0.003, role: "moqueta", category: "Suelos", stock: 3000, kind: "consumible", price: 4, priceMode: "m2", ...P }),
  escenario: add({ id: "item-escenario", sku: "ESC-2x1", name: "Módulo de escenario 2x1 m", unit: "ud", weightKg: 45, volumeM3: 0.25, role: "escenario", category: "Escenarios", stock: 110, kind: "granel", price: 18, priceMode: "unidad", roleAmount: 2 }),
  silla: add({ id: "item-silla", sku: "SIL", name: "Silla plegable blanca", unit: "ud", weightKg: 3, volumeM3: 0.03, role: "silla", category: "Mobiliario", stock: 1500, kind: "granel", price: 1.2, priceMode: "unidad", ...P }),
  mesaRedonda: add({ id: "item-mesa-redonda", sku: "MES-R180", name: "Mesa redonda Ø180", unit: "ud", weightKg: 25, volumeM3: 0.12, role: "mesa", category: "Mobiliario", stock: 160, kind: "granel", price: 9, priceMode: "unidad", ...P }),
  mesaAlta: add({ id: "item-mesa-alta", sku: "MES-ALT", name: "Mesa alta de cóctel", unit: "ud", weightKg: 12, volumeM3: 0.08, role: "mesa", category: "Mobiliario", stock: 80, kind: "granel", price: 7, priceMode: "unidad", ...P }),
  tablero: add({ id: "item-tablero", sku: "TAB", name: "Tablero 2x0,8 m", unit: "ud", weightKg: 16, volumeM3: 0.05, role: "otro", category: "Mobiliario", stock: 120, kind: "granel", price: 6, priceMode: "unidad", ...P }),
  mostrador: add({ id: "item-mostrador", sku: "MOS", name: "Mostrador", unit: "ud", weightKg: 40, volumeM3: 0.5, role: "otro", category: "Mobiliario", stock: 20, kind: "granel", price: 35, priceMode: "unidad", ...P }),
  foco: add({ id: "item-foco", sku: "FOC-LED", name: "Foco LED 100 W", unit: "ud", weightKg: 2, volumeM3: 0.01, role: "otro", category: "Iluminación", stock: 200, kind: "seriado", price: 8, priceMode: "unidad", ...P }),
  calefactor: add({ id: "item-calefactor", sku: "CAL-30", name: "Calefactor de gasoil 30 kW", unit: "ud", weightKg: 35, volumeM3: 0.3, role: "otro", category: "Climatización", stock: 16, kind: "seriado", price: 90, priceMode: "dia", ...P }),
  extintor: add({ id: "item-extintor", sku: "EXT-6", name: "Extintor 6 kg", unit: "ud", weightKg: 10, volumeM3: 0.02, role: "otro", category: "Seguridad", stock: 60, kind: "seriado", price: 5, priceMode: "unidad", ...P }),
  certificado: add({ id: "item-certificado", sku: "CERT", name: "Certificado de instalación", unit: "ud", weightKg: 0, volumeM3: 0, role: "otro", category: "Servicios", stock: 0, kind: "servicio", price: 120, priceMode: "unidad" }),
};

type FamDef = {
  id: string;
  code: string;
  name: string;
  width: number;
  eave: number;
  ridge: number;
  height: "baja" | "alta";
  shape: StructureFamily["roofShape"];
  truss: string;
  maxModules: number;
  params: Record<string, number>;
  pricePerM2: number;
};

const famDefs: FamDef[] = [
  { id: "fam-7b", code: "7B", name: "Carpa 7 m pata baja", width: 7, eave: 2.5, ridge: 3.6, height: "baja", shape: "dos_aguas", truss: TRUSS.C7B, maxModules: 6, params: { correas_por_tramo: 3, pesos_por_pata: 1, estacas_por_pata: 2, tensores_por_arriostramiento: 4, peso_kg: 500 }, pricePerM2: 9 },
  { id: "fam-10b", code: "10B", name: "Carpa 10 m pata baja", width: 10, eave: 2.6, ridge: 4.2, height: "baja", shape: "dos_aguas", truss: TRUSS.C10B, maxModules: 20, params: { correas_por_tramo: 5, pesos_por_pata: 1, estacas_por_pata: 2, tensores_por_arriostramiento: 4, peso_kg: 500 }, pricePerM2: 8 },
  { id: "fam-10e", code: "10E", name: "Carpa 10 m extra", width: 10, eave: 3, ridge: 4.6, height: "baja", shape: "dos_aguas", truss: TRUSS.C1014B, maxModules: 8, params: { correas_por_tramo: 5, pesos_por_pata: 1, estacas_por_pata: 2, tensores_por_arriostramiento: 4, peso_kg: 500 }, pricePerM2: 8.5 },
  { id: "fam-14b", code: "14B", name: "Carpa 14 m pata baja", width: 14, eave: 3, ridge: 5.1, height: "baja", shape: "dos_aguas", truss: TRUSS.C1014B, maxModules: 8, params: { correas_por_tramo: 7, pesos_por_pata: 2, estacas_por_pata: 3, tensores_por_arriostramiento: 4, peso_kg: 500 }, pricePerM2: 8.5 },
  { id: "fam-15a", code: "15A", name: "Carpa 15 m pata alta", width: 15, eave: 4, ridge: 6.5, height: "alta", shape: "dos_aguas", truss: TRUSS.C15A, maxModules: 24, params: { correas_por_tramo: 7, pesos_por_pata: 2, estacas_por_pata: 4, tensores_por_arriostramiento: 4, peso_kg: 500 }, pricePerM2: 10 },
  { id: "fam-15b", code: "15B", name: "Carpa 15 m pata baja", width: 15, eave: 3, ridge: 5.5, height: "baja", shape: "dos_aguas", truss: TRUSS.C15B, maxModules: 20, params: { correas_por_tramo: 7, pesos_por_pata: 2, estacas_por_pata: 4, tensores_por_arriostramiento: 4, peso_kg: 500 }, pricePerM2: 9 },
  { id: "fam-20a", code: "20A", name: "Carpa 20 m pata alta", width: 20, eave: 4, ridge: 7.2, height: "alta", shape: "dos_aguas", truss: TRUSS.C20A, maxModules: 20, params: { correas_por_tramo: 9, pesos_por_pata: 3, estacas_por_pata: 4, tensores_por_arriostramiento: 4, peso_kg: 500 }, pricePerM2: 11 },
];

// lonas por ancho
for (const w of [7, 10, 14, 15, 20]) {
  roof(w, "blanco");
  roof(w, "transparente");
  pico(w);
}
const frontalKeys = new Set<string>();
for (const f of famDefs) {
  const k = `${f.width}-${f.height}`;
  if (frontalKeys.has(k)) continue;
  frontalKeys.add(k);
  frontal(f.width, f.height, "blanco");
  frontal(f.width, f.height, "transparente");
}

export const fixtureFamilies: StructureFamily[] = [
  ...famDefs.map((f) => ({
    id: f.id,
    code: f.code,
    name: f.name,
    width: f.width,
    moduleLength: 5,
    eaveHeight: f.eave,
    ridgeHeight: f.ridge,
    heightClass: f.height,
    roofShape: f.shape,
    trussItemId: f.truss,
    minModules: 1,
    maxModules: f.maxModules,
    parameters: f.params,
    labor: { ...DEFAULT_LABOR, minPorPortico: f.width >= 15 ? 70 : f.width >= 14 ? 55 : 40, personasMinimas: f.width >= 15 ? 6 : 4 },
  })),
  {
    id: "fam-jaima",
    code: "J5",
    name: "Jaima 5x5",
    width: 5,
    moduleLength: 5,
    eaveHeight: 2.5,
    ridgeHeight: 5,
    heightClass: "baja",
    roofShape: "jaima",
    trussItemId: SAT.jaima,
    minModules: 1,
    maxModules: 1,
    parameters: { pesos_por_pata: 1, estacas_por_pata: 2, peso_kg: 500 },
    labor: { ...DEFAULT_LABOR, minPorPortico: 0, personasMinimas: 2 },
  },
];

export const fixturePricePerM2: Record<string, number> = Object.fromEntries([
  ...famDefs.map((f) => [f.id, f.pricePerM2]),
  ["fam-jaima", 0],
]);

const rules: BomRule[] = [];
let ruleSeq = 0;
const rule = (familyId: string, itemId: string, formula: string, group: BomGroup, condition: string | null = null, note: string | null = null) => {
  rules.push({ id: `rule-${familyId}-${++ruleSeq}`, familyId, itemId, formula, condition, group, sortOrder: ruleSeq, note });
};

for (const f of famDefs) {
  const s = sides[f.height];
  rule(f.id, f.truss, "porticos", "estructura", null, "Una cercha por pórtico");
  rule(f.id, f.height === "alta" ? HW.pilarAlta : HW.pilarBaja, "porticos * 2", "estructura");
  rule(f.id, HW.placa, "porticos * 2", "estructura");
  rule(f.id, HW.correa, "modulos * correas_por_tramo", "estructura", null, "Pendiente de validar con el fabricante");
  rule(f.id, HW.tensor, "max(1, techo(modulos / 3)) * tensores_por_arriostramiento", "estructura", null, "Un arriostramiento cada 3 tramos");
  rule(f.id, `item-techo-${f.width}-blanco`, "techo.blanco", "lonas");
  rule(f.id, `item-techo-${f.width}-transparente`, "techo.transparente", "lonas");
  rule(f.id, s.blanco, "laterales.blanco", "lonas");
  rule(f.id, s.transparente, "laterales.transparente", "lonas");
  rule(f.id, s.ventana, "laterales.ventana", "lonas");
  rule(f.id, s.puerta, "laterales.puerta", "lonas");
  rule(f.id, `item-pico-${f.width}`, "frentes.con_pico", "lonas");
  rule(f.id, `item-frontal-${f.width}-${f.height}-blanco`, "frentes.completo_blanco", "lonas");
  rule(f.id, `item-frontal-${f.width}-${f.height}-transparente`, "frentes.completo_transparente", "lonas");
  rule(f.id, HW.peso, "porticos * 2 * pesos_por_pata", "anclaje", "fijacion = 'pesos'");
  rule(f.id, HW.estaca, "porticos * 2 * estacas_por_pata", "anclaje", "fijacion = 'anclaje'");
  rule(f.id, SAT.tarima, "superficie_tarima", "suelos");
  rule(f.id, SAT.suelo, "superficie_suelo", "suelos");
  rule(f.id, SAT.moqueta, "superficie_moqueta", "suelos");
  rule(f.id, SAT.escenario, "techo(escenario_m2 / 2)", "interior");
  rule(f.id, SAT.silla, "sillas", "interior");
  rule(f.id, SAT.mesaRedonda, "mesas_redondas", "interior");
  rule(f.id, SAT.mesaAlta, "mesas_altas", "interior");
}
rule("fam-jaima", SAT.jaima, "1", "estructura");
rule("fam-jaima", HW.peso, "4 * pesos_por_pata", "anclaje", "fijacion = 'pesos'");
rule("fam-jaima", HW.estaca, "4 * estacas_por_pata", "anclaje", "fijacion = 'anclaje'");
rule("fam-jaima", SAT.tarima, "superficie_tarima", "suelos");
rule("fam-jaima", SAT.suelo, "superficie_suelo", "suelos");
rule("fam-jaima", SAT.moqueta, "superficie_moqueta", "suelos");
rule("fam-jaima", SAT.silla, "sillas", "interior");
rule("fam-jaima", SAT.mesaRedonda, "mesas_redondas", "interior");
rule("fam-jaima", SAT.mesaAlta, "mesas_altas", "interior");

export const fixtureItems: FixtureItem[] = items;
export const fixtureRules: BomRule[] = rules;
export const fixtureGutter = { itemId: HW.canalon, unitLength: 5 };
export const fixtureVehicles: VehicleType[] = [
  { id: "veh-trailer", name: "Tráiler 13,6 m", maxPayloadKg: 24000, volumeM3: 90 },
  { id: "veh-camion-grua", name: "Camión grúa 12 t", maxPayloadKg: 6500, volumeM3: 32 },
  { id: "veh-furgoneta", name: "Furgoneta 3,5 t", maxPayloadKg: 1100, volumeM3: 12 },
];
export const fixtureItemIds = { TRUSS, HW, SAT, sides };
export const roleOf = (itemId: string): PartRole | undefined => items.find((i) => i.id === itemId)?.role;
