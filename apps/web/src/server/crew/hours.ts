/** Pure helpers for the Spanish working-time register (registro horario). */
export type EntryLike = { workerId: string; clockIn: Date; clockOut: Date | null; breakMinutes: number; diet: boolean };
export type PlannedLike = { workerId: string; start: Date; end: Date };

export const DAILY_ORDINARY_HOURS = 8;

/** Current instant (kept out of render bodies for the React purity lint). */
export const nowMs = () => Date.now();

const TZ = "Europe/Madrid";
export const madridDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export function workedHours(e: Pick<EntryLike, "clockIn" | "clockOut" | "breakMinutes">, now = new Date()): number {
  const end = e.clockOut ?? now;
  const h = (end.getTime() - e.clockIn.getTime()) / 3_600_000 - e.breakMinutes / 60;
  return Math.max(0, Math.round(h * 100) / 100);
}

export type DayRow = { workerId: string; day: string; planned: number; real: number; overtime: number; diets: number; open: boolean };

/** Aggregates planned vs real hours per worker and Madrid-local day. */
export function aggregateDays(entries: EntryLike[], planned: PlannedLike[], now = new Date()): DayRow[] {
  const map = new Map<string, DayRow>();
  const get = (workerId: string, day: string) => {
    const k = `${workerId}|${day}`;
    let r = map.get(k);
    if (!r) map.set(k, (r = { workerId, day, planned: 0, real: 0, overtime: 0, diets: 0, open: false }));
    return r;
  };
  for (const p of planned) get(p.workerId, madridDay(p.start)).planned += (p.end.getTime() - p.start.getTime()) / 3_600_000;
  for (const e of entries) {
    const r = get(e.workerId, madridDay(e.clockIn));
    r.real += workedHours(e, now);
    if (e.diet) r.diets += 1;
    if (!e.clockOut) r.open = true;
  }
  for (const r of map.values()) {
    r.planned = Math.round(r.planned * 100) / 100;
    r.real = Math.round(r.real * 100) / 100;
    r.overtime = Math.max(0, Math.round((r.real - DAILY_ORDINARY_HOURS) * 100) / 100);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day) || a.workerId.localeCompare(b.workerId));
}

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Monthly payroll export (semicolon CSV, Spanish decimal comma, Excel-friendly BOM). */
export function payrollCsv(rows: DayRow[], names: Map<string, string>): string {
  const n = (x: number) => x.toFixed(2).replace(".", ",");
  const lines = [["Trabajador", "Fecha", "Horas previstas", "Horas reales", "Horas extra", "Dietas"].join(";")];
  const totals = new Map<string, { p: number; r: number; o: number; d: number }>();
  for (const r of rows) {
    lines.push([names.get(r.workerId) ?? r.workerId, r.day, n(r.planned), n(r.real), n(r.overtime), r.diets].map(csvCell).join(";"));
    const t = totals.get(r.workerId) ?? { p: 0, r: 0, o: 0, d: 0 };
    t.p += r.planned;
    t.r += r.real;
    t.o += r.overtime;
    t.d += r.diets;
    totals.set(r.workerId, t);
  }
  lines.push("");
  lines.push(["Totales", "", "", "", "", ""].join(";"));
  for (const [w, t] of totals) lines.push([names.get(w) ?? w, "", n(t.p), n(t.r), n(t.o), t.d].map(csvCell).join(";"));
  return "\uFEFF" + lines.join("\r\n");
}

export type TrainingStatus = "sin_formacion" | "caducada" | "proxima" | "vigente";
export function trainingStatus(expires: string | null, today = new Date()): TrainingStatus {
  if (!expires) return "sin_formacion";
  const t = madridDay(today);
  if (expires < t) return "caducada";
  const soon = madridDay(new Date(today.getTime() + 30 * 86_400_000));
  return expires <= soon ? "proxima" : "vigente";
}
