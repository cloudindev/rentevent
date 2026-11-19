import { FRONT_TYPES, resizeConfiguration, ROOF_TYPES, SIDE_TYPES, type Composition, type StructureFamily, type TentPart } from "@rentevent/core";
import { cycle } from "@rentevent/core/geometry/gutter";

type Target = NonNullable<TentPart["target"]>;

/** Cycles the clicked element's type and returns a new composition (pure). */
export function applyPick(c: Composition, tentId: string, target: Target): Composition {
  return {
    ...c,
    tents: c.tents.map((t) => {
      if (t.id !== tentId) return t;
      const config = { ...t.config, bays: t.config.bays.map((b) => ({ ...b })), fronts: { ...t.config.fronts } };
      if (target.type === "roof") {
        const b = config.bays[target.bay]!;
        b.roof = cycle(ROOF_TYPES, b.roof);
      } else if (target.type === "side") {
        const b = config.bays[target.bay]!;
        b[target.side] = cycle(SIDE_TYPES, b[target.side]);
      } else {
        const f = config.fronts[target.end];
        config.fronts[target.end] = { ...f, type: cycle(FRONT_TYPES, f.type) };
      }
      return { ...t, config };
    }),
  };
}

export function changeModules(c: Composition, tentId: string, delta: number, family: Pick<StructureFamily, "minModules" | "maxModules">): Composition {
  return {
    ...c,
    tents: c.tents.map((t) => {
      if (t.id !== tentId) return t;
      const n = Math.min(family.maxModules, Math.max(family.minModules, t.config.modules + delta));
      return n === t.config.modules ? t : { ...t, config: resizeConfiguration(t.config, n) };
    }),
  };
}

export function describeTarget(target: Target): string {
  if (target.type === "roof") return `Techo · tramo ${target.bay + 1}`;
  if (target.type === "side") return `Lateral ${target.side === "left" ? "izquierdo" : "derecho"} · tramo ${target.bay + 1}`;
  return `Frente ${target.end === "start" ? "inicial" : "final"}`;
}
