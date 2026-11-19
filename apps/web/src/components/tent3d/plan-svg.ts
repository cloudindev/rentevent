/**
 * Pure 2D plan model (no DOM): shared by the interactive <TentPlan> and by
 * server-side PDF generation through `planToSvgString`.
 *
 * Plan frame: metres, X right, Y down. A tent's placement is its start-front
 * centre; rotation (degrees) turns its length axis clockwise (same convention
 * as @rentevent/core `tentCorners`).
 */
import {
  compositionBounds,
  detectCollisions,
  findGutterJoins,
  placeComposition,
  tentFootprint,
  type Composition,
  type SideType,
  type StructureFamily,
} from "@rentevent/core";
import { sharedEdge } from "@rentevent/core/geometry/gutter";

export const SIDE_COLORS: Record<SideType, string> = {
  blanco: "#6b6b68",
  transparente: "#3b82f6",
  ventana: "#0d9488",
  puerta: "#a855f7",
  abierto: "#d6d6d2",
};
export const ROOF_FILL = { blanco: "#f5f5f4", transparente: "#dbeafe", ninguno: "#ffffff" } as const;
export const DANGER = "#b4233f";
export const BRAND = "#f95f40";

export type PlanTent = {
  id: string;
  label: string;
  x: number;
  y: number;
  rotation: number;
  length: number;
  width: number;
  isJaima: boolean;
  bays: { x0: number; x1: number; roof: keyof typeof ROOF_FILL; left: SideType; right: SideType }[];
  fronts: { start: string; end: string };
  colliding: boolean;
  dims: string;
};

export type PlanModel = {
  tents: PlanTent[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  viewBox: [number, number, number, number];
  collisions: { a: string; b: string; depth: number }[];
  gutterCandidates: { a: string; b: string; length: number }[];
  gutters: { a: string; b: string; seg: [[number, number], [number, number]] }[];
  scaleBar: number;
};

const r1 = (n: number) => Math.round(n * 100) / 100;

export function buildPlanModel(composition: Composition, families: Pick<StructureFamily, "id" | "width" | "moduleLength" | "roofShape" | "name">[], pad = 4): PlanModel {
  const fams = new Map(families.map((f) => [f.id, f]));
  const placed = placeComposition(composition, fams as Map<string, StructureFamily>);
  const collisions = detectCollisions(placed);
  const colliding = new Set(collisions.flatMap((c) => [c.a, c.b]));
  const joined = new Set(composition.gutters.map((g) => [g.a, g.b].sort().join("|")));
  const gutterCandidates = findGutterJoins(placed).filter((g) => !joined.has([g.a, g.b].sort().join("|")));
  const byId = new Map(placed.map((p) => [p.id, p]));
  const gutters = composition.gutters.flatMap((g) => {
    const a = byId.get(g.a);
    const b = byId.get(g.b);
    const seg = a && b ? sharedEdge(a, b, 0.2) : null;
    return seg ? [{ a: g.a, b: g.b, seg }] : [];
  });

  const tents: PlanTent[] = composition.tents.flatMap((t) => {
    const f = fams.get(t.config.familyId);
    if (!f) return [];
    const { length, width } = tentFootprint(t.config, f);
    const isJaima = f.roofShape === "jaima";
    const m = isJaima ? length : f.moduleLength;
    return [
      {
        id: t.id,
        label: t.label || f.name,
        x: t.placement.x,
        y: t.placement.y,
        rotation: t.placement.rotation,
        length,
        width,
        isJaima,
        bays: t.config.bays.slice(0, isJaima ? 1 : t.config.modules).map((b, i) => ({ x0: i * m, x1: (i + 1) * m, roof: b.roof, left: b.left, right: b.right })),
        fronts: { start: t.config.fronts.start.type, end: t.config.fronts.end.type },
        colliding: colliding.has(t.id),
        dims: `${r1(width)} × ${r1(length)} m`,
      },
    ];
  });

  const b = compositionBounds(placed);
  const w = Math.max(10, b.maxX - b.minX);
  const h = Math.max(8, b.maxY - b.minY);
  const viewBox: [number, number, number, number] = [b.minX - pad, b.minY - pad, w + pad * 2, h + pad * 2];
  const span = Math.max(w, h);
  const scaleBar = span > 120 ? 20 : span > 50 ? 10 : 5;
  return { tents, bounds: b, viewBox, collisions, gutterCandidates, gutters, scaleBar };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** SVG fragment (in tent-local coordinates) for one tent. Used by both renderers. */
export function tentSvg(t: PlanTent, opts: { selected?: boolean; stroke?: number } = {}): string {
  const sw = opts.stroke ?? 0.08;
  const hw = t.width / 2;
  const parts: string[] = [];
  for (const b of t.bays) {
    parts.push(
      `<rect x="${b.x0}" y="${-hw}" width="${b.x1 - b.x0}" height="${t.width}" fill="${ROOF_FILL[b.roof]}" stroke="#d6d6d2" stroke-width="${sw / 2}"${b.roof === "ninguno" ? ' fill-opacity="0.2" stroke-dasharray="0.4 0.3"' : ""}/>`,
    );
  }
  if (!t.isJaima) {
    for (let i = 0; i <= t.bays.length; i++) {
      const x = t.bays[i]?.x0 ?? t.length;
      parts.push(`<line x1="${x}" y1="${-hw}" x2="${x}" y2="${hw}" stroke="#a3a39f" stroke-width="${sw}"/>`);
    }
    for (const b of t.bays) {
      for (const [side, y] of [
        ["left", -hw],
        ["right", hw],
      ] as const) {
        const type = b[side];
        parts.push(
          `<line x1="${b.x0 + 0.15}" y1="${y}" x2="${b.x1 - 0.15}" y2="${y}" stroke="${SIDE_COLORS[type]}" stroke-width="${sw * 4}" stroke-linecap="round"${type === "abierto" ? ` stroke-dasharray="${sw * 6} ${sw * 6}"` : ""}/>`,
        );
      }
    }
    for (const [end, x] of [
      ["start", 0],
      ["end", t.length],
    ] as const) {
      const type = t.fronts[end];
      if (type === "sin_pico") continue;
      parts.push(
        `<line x1="${x}" y1="${-hw + 0.15}" x2="${x}" y2="${hw - 0.15}" stroke="${type === "completo" ? "#111111" : "#a3a39f"}" stroke-width="${sw * 3}"${type === "abierto" ? ` stroke-dasharray="${sw * 6} ${sw * 6}"` : ""}/>`,
      );
    }
  } else {
    parts.push(`<line x1="0" y1="${-hw}" x2="${t.length}" y2="${hw}" stroke="#a3a39f" stroke-width="${sw}"/><line x1="0" y1="${hw}" x2="${t.length}" y2="${-hw}" stroke="#a3a39f" stroke-width="${sw}"/>`);
  }
  const outline = t.colliding ? DANGER : "#111111";
  parts.push(`<rect x="0" y="${-hw}" width="${t.length}" height="${t.width}" fill="${t.colliding ? DANGER : "none"}" fill-opacity="${t.colliding ? 0.12 : 0}" stroke="${outline}" stroke-width="${sw * (t.colliding ? 2.2 : 1)}"/>`);
  if (opts.selected) parts.push(`<rect x="-0.45" y="${-hw - 0.45}" width="${t.length + 0.9}" height="${t.width + 0.9}" rx="0.3" fill="none" stroke="${BRAND}" stroke-width="${sw * 1.6}"/>`);
  // dimension lines (outside left side and start front)
  const off = 1.4;
  const fs = Math.max(0.55, Math.min(1.1, t.width / 12));
  parts.push(
    `<g stroke="#6b6b68" stroke-width="${sw * 0.8}" fill="none"><line x1="0" y1="${-hw - off}" x2="${t.length}" y2="${-hw - off}"/><line x1="0" y1="${-hw - off - 0.35}" x2="0" y2="${-hw - off + 0.35}"/><line x1="${t.length}" y1="${-hw - off - 0.35}" x2="${t.length}" y2="${-hw - off + 0.35}"/>` +
      `<line x1="${-off}" y1="${-hw}" x2="${-off}" y2="${hw}"/><line x1="${-off - 0.35}" y1="${-hw}" x2="${-off + 0.35}" y2="${-hw}"/><line x1="${-off - 0.35}" y1="${hw}" x2="${-off + 0.35}" y2="${hw}"/></g>`,
    `<text x="${t.length / 2}" y="${-hw - off - 0.35}" font-size="${fs}" text-anchor="middle" fill="#111111" font-family="Inter, Arial, sans-serif">${r1(t.length)} m</text>`,
    `<text transform="translate(${-off - 0.35} 0) rotate(-90)" font-size="${fs}" text-anchor="middle" fill="#111111" font-family="Inter, Arial, sans-serif">${r1(t.width)} m</text>`,
    `<text x="${t.length / 2}" y="${fs * 0.35}" font-size="${fs * 0.95}" text-anchor="middle" fill="#111111" font-weight="600" font-family="Inter, Arial, sans-serif">${esc(t.label)}</text>`,
  );
  return parts.join("");
}

export function scaleBarSvg(model: PlanModel): string {
  const [vx, vy, , vh] = model.viewBox;
  const x = vx + 1;
  const y = vy + vh - 1;
  const s = model.scaleBar;
  return `<g font-family="Inter, Arial, sans-serif"><rect x="${x}" y="${y - 0.3}" width="${s}" height="0.3" fill="#111111"/><rect x="${x}" y="${y - 0.3}" width="${s / 2}" height="0.3" fill="#ffffff" stroke="#111111" stroke-width="0.05"/><text x="${x + s + 0.4}" y="${y}" font-size="0.8" fill="#111111">${s} m</text></g>`;
}

export function guttersSvg(model: PlanModel): string {
  return model.gutters
    .map((g) => `<line x1="${g.seg[0][0]}" y1="${g.seg[0][1]}" x2="${g.seg[1][0]}" y2="${g.seg[1][1]}" stroke="#2c5fb3" stroke-width="0.35" stroke-linecap="round" opacity="0.8"/>`)
    .join("");
}

/** Self-contained SVG document of the dimensioned plan (server-safe). */
export function planToSvgString(composition: Composition, families: Pick<StructureFamily, "id" | "width" | "moduleLength" | "roofShape" | "name">[], opts: { widthPx?: number; title?: string } = {}): string {
  const model = buildPlanModel(composition, families);
  const [vx, vy, vw, vh] = model.viewBox;
  const widthPx = opts.widthPx ?? 900;
  const heightPx = Math.round((widthPx * vh) / vw);
  const body = model.tents.map((t) => `<g transform="translate(${t.x} ${t.y}) rotate(${t.rotation})">${tentSvg(t)}</g>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="${vx} ${vy} ${vw} ${vh}">${opts.title ? `<title>${esc(opts.title)}</title>` : ""}<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#ffffff"/>${body}${guttersSvg(model)}${scaleBarSvg(model)}</svg>`;
}
