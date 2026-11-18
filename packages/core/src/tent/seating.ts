import type { SeatingLayout } from "./schema";

export type SeatingInput = {
  layout: SeatingLayout;
  /** interior length along the ridge, metres */
  length: number;
  /** interior width, metres */
  width: number;
  stage: { enabled: boolean; width: number; depth: number } | null;
};

export type TablePlacement = { x: number; y: number; kind: "redonda" | "alta" };
export type ChairPlacement = { x: number; y: number; rotation: number };

export type SeatingResult = {
  tables: TablePlacement[];
  chairs: ChairPlacement[];
  seats: number;
  mesasRedondas: number;
  mesasAltas: number;
  sillas: number;
  /** standing capacity for cocktail layouts */
  standing: number;
};

const WALL_MARGIN = 1;
const STAGE_GAP = 1.5;
const BANQUET_PITCH = 3;
const ROUND_TABLE_SEATS = 10;
const ROUND_TABLE_RADIUS = 0.9;
const THEATRE_SEAT_WIDTH = 0.55;
const THEATRE_ROW_PITCH = 0.95;
const THEATRE_AISLE = 1.2;
const COCKTAIL_M2_PER_PERSON = 0.8;
const COCKTAIL_PEOPLE_PER_TABLE = 10;

/**
 * Automatic interior distribution. Coordinates are in the tent frame:
 * x runs along the length from the start front (0) to the end front,
 * y runs across the width centred on the ridge.
 */
export function computeSeating(input: SeatingInput): SeatingResult {
  const empty: SeatingResult = { tables: [], chairs: [], seats: 0, mesasRedondas: 0, mesasAltas: 0, sillas: 0, standing: 0 };
  if (input.layout === "ninguno") return empty;
  const stageDepth = input.stage?.enabled ? input.stage.depth + STAGE_GAP : 0;
  const x0 = WALL_MARGIN + stageDepth;
  const x1 = input.length - WALL_MARGIN;
  const halfW = input.width / 2 - WALL_MARGIN;
  if (x1 - x0 <= 0 || halfW <= 0) return empty;

  if (input.layout === "banquete") {
    const tables: TablePlacement[] = [];
    const chairs: ChairPlacement[] = [];
    const cols = Math.floor((x1 - x0) / BANQUET_PITCH);
    const rows = Math.floor((2 * halfW) / BANQUET_PITCH);
    const offX = x0 + ((x1 - x0) - cols * BANQUET_PITCH) / 2 + BANQUET_PITCH / 2;
    const offY = -halfW + (2 * halfW - rows * BANQUET_PITCH) / 2 + BANQUET_PITCH / 2;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = offX + c * BANQUET_PITCH;
        const y = offY + r * BANQUET_PITCH;
        tables.push({ x, y, kind: "redonda" });
        for (let s = 0; s < ROUND_TABLE_SEATS; s++) {
          const a = (s / ROUND_TABLE_SEATS) * Math.PI * 2;
          const rr = ROUND_TABLE_RADIUS + 0.35;
          chairs.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr, rotation: a + Math.PI });
        }
      }
    }
    return { ...empty, tables, chairs, seats: chairs.length, mesasRedondas: tables.length, sillas: chairs.length };
  }

  if (input.layout === "teatro") {
    const chairs: ChairPlacement[] = [];
    const rows = Math.floor((x1 - x0) / THEATRE_ROW_PITCH);
    const blockWidth = halfW - THEATRE_AISLE / 2;
    const perSide = Math.max(0, Math.floor(blockWidth / THEATRE_SEAT_WIDTH));
    for (let r = 0; r < rows; r++) {
      const x = x0 + r * THEATRE_ROW_PITCH + THEATRE_ROW_PITCH / 2;
      for (let s = 0; s < perSide; s++) {
        const off = THEATRE_AISLE / 2 + s * THEATRE_SEAT_WIDTH + THEATRE_SEAT_WIDTH / 2;
        chairs.push({ x, y: off, rotation: Math.PI });
        chairs.push({ x, y: -off, rotation: Math.PI });
      }
    }
    return { ...empty, chairs, seats: chairs.length, sillas: chairs.length };
  }

  // cóctel
  const area = (x1 - x0) * 2 * halfW;
  const standing = Math.floor(area / COCKTAIL_M2_PER_PERSON);
  const wanted = Math.ceil(standing / COCKTAIL_PEOPLE_PER_TABLE);
  const tables: TablePlacement[] = [];
  const cols = Math.max(1, Math.floor((x1 - x0) / 2.5));
  const rows = Math.max(1, Math.floor((2 * halfW) / 2.5));
  for (let c = 0; c < cols && tables.length < wanted; c++) {
    for (let r = 0; r < rows && tables.length < wanted; r++) {
      tables.push({
        x: x0 + (c + 0.5) * ((x1 - x0) / cols),
        y: -halfW + (r + 0.5) * ((2 * halfW) / rows),
        kind: "alta",
      });
    }
  }
  return { ...empty, tables, mesasAltas: tables.length, standing, seats: 0 };
}
