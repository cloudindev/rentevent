/**
 * Pure warehouse helpers (no DB, no server-only): pick list statuses,
 * material aggregation, location ordering, return settlement and
 * inspection due dates. Shared by server actions, pages and tests.
 */

export type PickKind = "salida" | "retorno";
export type PickStatus = "por_preparar" | "preparado" | "cargado" | "en_obra" | "por_volver" | "retrasado" | "devuelto";

export const PICK_STATUS_LABEL: Record<PickStatus, string> = {
  por_preparar: "Por preparar",
  preparado: "Preparado",
  cargado: "Cargado",
  en_obra: "En obra",
  por_volver: "Por volver",
  retrasado: "Retrasado",
  devuelto: "Devuelto",
};

export const PICK_STATUS_TONE: Record<PickStatus, "neutral" | "info" | "success" | "warning" | "danger" | "brand"> = {
  por_preparar: "neutral",
  preparado: "info",
  cargado: "success",
  en_obra: "brand",
  por_volver: "warning",
  retrasado: "danger",
  devuelto: "success",
};

export type LineCounts = { quantity: number; prepared: number; loaded: number; returned: number; damaged: number; lost: number };

/** Status of one line. Closed lists keep their stored status. */
export function lineStatus(l: LineCounts, kind: PickKind, overdue = false): PickStatus {
  if (kind === "salida") {
    if (l.quantity > 0 && l.loaded >= l.quantity) return "cargado";
    if (l.quantity > 0 && l.prepared >= l.quantity) return "preparado";
    return "por_preparar";
  }
  if (l.returned + l.damaged + l.lost >= l.quantity) return "devuelto";
  return overdue ? "retrasado" : "por_volver";
}

/** Status of a whole list from its lines. */
export function listStatus(lines: LineCounts[], kind: PickKind, opts: { dueAt?: Date | null; now?: Date; closed?: boolean } = {}): PickStatus {
  const now = opts.now ?? new Date();
  if (kind === "salida") {
    if (opts.closed) return "en_obra";
    if (lines.length === 0) return "por_preparar";
    const st = lines.map((l) => lineStatus(l, kind));
    if (st.every((s) => s === "cargado")) return "cargado";
    if (st.every((s) => s === "cargado" || s === "preparado")) return "preparado";
    return "por_preparar";
  }
  // a return is only "devuelto" once it has been closed (movements, repairs and stock posted)
  if (opts.closed) return "devuelto";
  const overdue = Boolean(opts.dueAt && opts.dueAt.getTime() < now.getTime());
  return overdue ? "retrasado" : "por_volver";
}

/** 0–100 progress of a list. */
export function progress(lines: LineCounts[], kind: PickKind): number {
  const total = lines.reduce((s, l) => s + l.quantity, 0);
  if (total <= 0) return 0;
  const done = lines.reduce((s, l) => s + Math.min(l.quantity, kind === "salida" ? Math.max(l.loaded, l.prepared * 0.5 + l.loaded * 0.5) : l.returned + l.damaged + l.lost), 0);
  return Math.min(100, Math.round((done / total) * 100));
}

/** Sums order material per item (order lines with an item id, incl. BOM sub-lines; priced supplements excluded). */
export function aggregateMaterial(rows: { itemId: string | null; quantity: number | string; kind: string }[]): { itemId: string; quantity: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!r.itemId || r.kind === "suplemento") continue;
    m.set(r.itemId, Math.round(((m.get(r.itemId) ?? 0) + Number(r.quantity)) * 100) / 100);
  }
  return [...m.entries()].map(([itemId, quantity]) => ({ itemId, quantity })).filter((x) => x.quantity > 0);
}

/** Natural ordering by warehouse location ("A-02" < "A-10" < "B-01"); no location last. */
export function compareLocation(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}

export function groupByLocation<T extends { location: string | null }>(lines: T[]): { location: string; lines: T[] }[] {
  const sorted = [...lines].sort((x, y) => compareLocation(x.location, y.location));
  const out: { location: string; lines: T[] }[] = [];
  for (const l of sorted) {
    const key = l.location?.split("-")[0] ? `Pasillo ${l.location.split("-")[0]}` : "Sin ubicación";
    const g = out.find((x) => x.location === key);
    if (g) g.lines.push(l);
    else out.push({ location: key, lines: [l] });
  }
  return out;
}

/** Settles a returned line: missing units that were not counted are treated as lost only when `missingAsLost`. */
export function settleReturn(l: LineCounts, missingAsLost: boolean) {
  const accounted = l.returned + l.damaged + l.lost;
  const missing = Math.max(0, l.quantity - accounted);
  return { returned: l.returned, damaged: l.damaged, lost: l.lost + (missingAsLost ? missing : 0), missing: missingAsLost ? 0 : missing };
}

/** Clamps a counter update to [0, max]. */
export const clampCount = (v: number, max: number) => Math.max(0, Math.min(Math.round(v * 100) / 100, max));

export type InspectionStatus = "vencida" | "proxima" | "ok" | "sin_plan";

/** Next inspection date from the interval and the last inspection (or purchase / creation date). */
export function inspectionDue(intervalDays: number | null | undefined, last: Date | null | undefined, fallback: Date | null | undefined, now = new Date(), soonDays = 30): { nextDue: Date | null; status: InspectionStatus; daysLeft: number | null } {
  if (!intervalDays || intervalDays <= 0) return { nextDue: null, status: "sin_plan", daysLeft: null };
  const base = last ?? fallback ?? null;
  if (!base) return { nextDue: now, status: "vencida", daysLeft: 0 };
  const nextDue = new Date(base.getTime() + intervalDays * 86_400_000);
  const daysLeft = Math.ceil((nextDue.getTime() - now.getTime()) / 86_400_000);
  return { nextDue, status: daysLeft < 0 ? "vencida" : daysLeft <= soonDays ? "proxima" : "ok", daysLeft };
}

/** Document number like ALB-2026-0001. */
export const deliveryNoteNumber = (year: number, n: number) => `ALB-${year}-${String(n).padStart(4, "0")}`;

/** Resolves a scanned code against the pick list lines: serial QR first, then SKU barcode. */
export function matchScan(code: string, lines: { id: string; itemId: string; sku: string }[], unitByQr: Map<string, { itemId: string; serial: string }>): { lineId: string; serial: string | null } | null {
  const c = code.trim();
  const unit = unitByQr.get(c);
  if (unit) {
    const line = lines.find((l) => l.itemId === unit.itemId);
    return line ? { lineId: line.id, serial: unit.serial } : null;
  }
  const bySku = lines.find((l) => l.sku.toLowerCase() === c.toLowerCase());
  return bySku ? { lineId: bySku.id, serial: null } : null;
}

/** Current time (kept out of render bodies for the React purity lint rule). */
export const nowMs = () => Date.now();
