import type { Scope } from "../expr";
import { computeSeating } from "./seating";
import { FLOOR_KINDS, SIDE_TYPES, type StructureFamily, type TentConfiguration } from "./schema";

/** Variables always available to BOM formulas, with a description for the rule editor. */
export const VARIABLE_DOCS: { name: string; description: string }[] = [
  { name: "modulos", description: "Número de módulos (tramos) de la carpa" },
  { name: "porticos", description: "Pórticos o cerchas: módulos + 1" },
  { name: "largo", description: "Largo total en metros" },
  { name: "ancho", description: "Ancho (luz de la cercha) en metros" },
  { name: "altura", description: "Altura lateral en metros" },
  { name: "pata_alta", description: "Verdadero si la familia es de pata alta" },
  { name: "forma", description: "'dos_aguas', 'poligonal' o 'jaima'" },
  { name: "perimetro", description: "Perímetro en metros" },
  { name: "superficie", description: "Superficie cubierta en m²" },
  { name: "tramos_con_techo", description: "Tramos con lona de techo" },
  { name: "techo.blanco", description: "Tramos con techo blanco" },
  { name: "techo.transparente", description: "Tramos con techo transparente" },
  { name: "techo.ninguno", description: "Tramos sin techo" },
  ...SIDE_TYPES.map((s) => ({ name: `laterales.${s}`, description: `Laterales de tipo ${s}` })),
  { name: "laterales.cerrados", description: "Laterales que llevan lona (todos menos abiertos)" },
  { name: "frentes.completo", description: "Frentes con pico completo" },
  { name: "frentes.abierto", description: "Frentes con pico pero abiertos" },
  { name: "frentes.sin_pico", description: "Frentes sin pico" },
  { name: "frentes.con_pico", description: "Frentes con pico (completo o abierto)" },
  { name: "frentes.completo_blanco", description: "Frentes completos con lona blanca" },
  { name: "frentes.completo_transparente", description: "Frentes completos con lona transparente" },
  { name: "fijacion", description: "'anclaje' o 'pesos'" },
  { name: "pesos", description: "Verdadero si la fijación es con pesos" },
  { name: "superficie_tarima", description: "m² de tarima (descontando tramos excluidos)" },
  { name: "superficie_suelo", description: "m² de suelo (descontando tramos excluidos)" },
  { name: "superficie_moqueta", description: "m² de moqueta (descontando tramos excluidos)" },
  { name: "escenario_m2", description: "Superficie del escenario en m²" },
  { name: "sillas", description: "Sillas de la distribución interior" },
  { name: "mesas_redondas", description: "Mesas redondas de banquete" },
  { name: "mesas_altas", description: "Mesas altas de cóctel" },
  { name: "plazas", description: "Plazas sentadas" },
];

export const BASE_VARIABLE_NAMES = VARIABLE_DOCS.map((v) => v.name);

/** Names usable in formulas for a family: base variables plus its parameters. */
export function variableNamesFor(family: Pick<StructureFamily, "parameters">): string[] {
  return [...BASE_VARIABLE_NAMES, ...Object.keys(family.parameters)];
}

export function computeVariables(config: TentConfiguration, family: StructureFamily): Scope {
  const modulos = config.modules;
  const isJaima = family.roofShape === "jaima";
  const largo = modulos * family.moduleLength;
  const ancho = family.width;
  const bays = config.bays.slice(0, modulos);
  const bayArea = family.moduleLength * ancho;

  const roofCount = { blanco: 0, transparente: 0, ninguno: 0 };
  const sideCount: Record<string, number> = Object.fromEntries(SIDE_TYPES.map((s) => [s, 0]));
  for (const b of bays) {
    roofCount[b.roof]++;
    sideCount[b.left] = (sideCount[b.left] ?? 0) + 1;
    sideCount[b.right] = (sideCount[b.right] ?? 0) + 1;
  }
  const fronts = [config.fronts.start, config.fronts.end];
  const frontCount = (t: string) => fronts.filter((f) => f.type === t).length;

  const floorArea: Record<string, number> = {};
  for (const kind of FLOOR_KINDS) {
    const f = config.floors[kind];
    const excluded = new Set(f.excludedBays.filter((b) => b < modulos));
    floorArea[kind] = f.enabled ? (modulos - excluded.size) * bayArea : 0;
  }

  const stage = config.interior.stage;
  const seating = computeSeating({
    layout: config.interior.layout,
    length: largo,
    width: ancho,
    stage: stage.enabled ? stage : null,
  });

  const scope: Scope = {
    modulos,
    porticos: isJaima ? 0 : modulos + 1,
    largo,
    ancho,
    altura: family.eaveHeight,
    pata_alta: family.heightClass === "alta",
    forma: family.roofShape,
    perimetro: 2 * (largo + ancho),
    superficie: largo * ancho,
    tramos_con_techo: roofCount.blanco + roofCount.transparente,
    "techo.blanco": roofCount.blanco,
    "techo.transparente": roofCount.transparente,
    "techo.ninguno": roofCount.ninguno,
    "laterales.cerrados": bays.length * 2 - (sideCount.abierto ?? 0),
    "frentes.completo": frontCount("completo"),
    "frentes.abierto": frontCount("abierto"),
    "frentes.sin_pico": frontCount("sin_pico"),
    "frentes.con_pico": frontCount("completo") + frontCount("abierto"),
    "frentes.completo_blanco": fronts.filter((f) => f.type === "completo" && f.material === "blanco").length,
    "frentes.completo_transparente": fronts.filter((f) => f.type === "completo" && f.material === "transparente").length,
    fijacion: config.anchoring,
    pesos: config.anchoring === "pesos",
    superficie_tarima: floorArea.tarima ?? 0,
    superficie_suelo: floorArea.suelo ?? 0,
    superficie_moqueta: floorArea.moqueta ?? 0,
    escenario_m2: stage.enabled ? stage.width * stage.depth : 0,
    sillas: seating.sillas,
    mesas_redondas: seating.mesasRedondas,
    mesas_altas: seating.mesasAltas,
    plazas: seating.seats,
  };
  for (const s of SIDE_TYPES) scope[`laterales.${s}`] = sideCount[s] ?? 0;
  for (const [k, v] of Object.entries(family.parameters)) {
    if (!(k in scope)) scope[k] = v;
  }
  return scope;
}
