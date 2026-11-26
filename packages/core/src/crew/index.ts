/**
 * Crew planning rules: conflict detection before saving an assignment and
 * automatic crew suggestion. Times are epoch milliseconds.
 */

export const SKILLS = [
  "jefe_equipo",
  "montador",
  "conductor_b",
  "conductor_c",
  "conductor_ce",
  "carretillero",
  "trabajos_altura",
  "gruista",
] as const;
export type Skill = (typeof SKILLS)[number];

export const SKILL_LABELS: Record<Skill, string> = {
  jefe_equipo: "Jefe de equipo",
  montador: "Montador",
  conductor_b: "Conductor (B)",
  conductor_c: "Conductor (C)",
  conductor_ce: "Conductor (C+E)",
  carretillero: "Carretillero",
  trabajos_altura: "Trabajos en altura",
  gruista: "Gruista",
};

export type WorkerInfo = {
  id: string;
  name: string;
  skills: string[];
  /** ISO date (YYYY-MM-DD) of safety training expiry, or null */
  trainingExpiresAt: string | null;
  weeklyHoursLimit: number;
  /** unavailability ranges: holidays, sick leave… */
  unavailable: { start: number; end: number; reason: string }[];
  home?: { lat: number; lng: number } | null;
  costPerHour?: number;
};

export type ShiftInfo = {
  id: string;
  start: number;
  end: number;
  requiredSkills: string[];
  /** licence skill required when a vehicle is attached */
  vehicleLicence?: string | null;
  location?: { lat: number; lng: number } | null;
  label?: string;
};

export type ExistingAssignment = { workerId: string; shift: ShiftInfo };

export type ConflictCode = "solape" | "habilidad" | "formacion" | "descanso" | "horas_semana" | "no_disponible" | "sin_conductor";
export type Conflict = { code: ConflictCode; severity: "error" | "warning"; message: string };

const HOUR = 3_600_000;
export const MIN_REST_HOURS = 12;

const fmt = (t: number) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(t);

/** Monday 00:00 (Europe/Madrid approximation via UTC offset of the instant). */
export function weekStart(t: number): number {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

/** Higher licences include the lower ones: C+E drives C and B vehicles, C drives B vehicles. */
const LICENCE_COVERS: Record<string, string[]> = {
  conductor_b: ["conductor_b", "conductor_c", "conductor_ce"],
  conductor_c: ["conductor_c", "conductor_ce"],
  conductor_ce: ["conductor_ce"],
};
export function canDrive(skills: readonly string[], required: string): boolean {
  return (LICENCE_COVERS[required] ?? [required]).some((l) => skills.includes(l));
}

export function checkAssignment(input: {
  worker: WorkerInfo;
  shift: ShiftInfo;
  existing: ExistingAssignment[];
  /** other workers already on this shift, for the driver check */
  crewOnShift?: WorkerInfo[];
  today?: string;
}): Conflict[] {
  const { worker, shift } = input;
  const out: Conflict[] = [];
  const mine = input.existing.filter((a) => a.workerId === worker.id && a.shift.id !== shift.id);

  for (const a of mine) {
    if (a.shift.start < shift.end && shift.start < a.shift.end) {
      out.push({ code: "solape", severity: "error", message: `${worker.name} ya está asignado a ${a.shift.label ?? "otro turno"} (${fmt(a.shift.start)})` });
    }
  }

  const missing = shift.requiredSkills.filter((s) => !worker.skills.includes(s));
  if (missing.length) {
    out.push({
      code: "habilidad",
      severity: "warning",
      message: `Le falta: ${missing.map((s) => SKILL_LABELS[s as Skill] ?? s).join(", ")}`,
    });
  }

  const shiftDay = new Date(shift.start).toISOString().slice(0, 10);
  if (!worker.trainingExpiresAt) {
    out.push({ code: "formacion", severity: "warning", message: "Sin formación en prevención registrada" });
  } else if (worker.trainingExpiresAt < shiftDay) {
    out.push({ code: "formacion", severity: "error", message: `Formación en prevención caducada el ${worker.trainingExpiresAt}` });
  }

  for (const u of worker.unavailable) {
    if (u.start < shift.end && shift.start < u.end) {
      out.push({ code: "no_disponible", severity: "error", message: `No disponible: ${u.reason}` });
    }
  }

  for (const a of mine) {
    const gapAfter = shift.start - a.shift.end;
    const gapBefore = a.shift.start - shift.end;
    const gap = gapAfter >= 0 ? gapAfter : gapBefore >= 0 ? gapBefore : -1;
    if (gap >= 0 && gap < MIN_REST_HOURS * HOUR) {
      out.push({
        code: "descanso",
        severity: "warning",
        message: `Solo ${Math.round((gap / HOUR) * 10) / 10} h de descanso entre jornadas (mínimo ${MIN_REST_HOURS} h)`,
      });
      break;
    }
  }

  const ws = weekStart(shift.start);
  const we = ws + 7 * 24 * HOUR;
  const weekHours =
    mine
      .filter((a) => a.shift.start >= ws && a.shift.start < we)
      .reduce((s, a) => s + (a.shift.end - a.shift.start) / HOUR, 0) +
    (shift.end - shift.start) / HOUR;
  if (weekHours > worker.weeklyHoursLimit) {
    out.push({
      code: "horas_semana",
      severity: "warning",
      message: `Sumaría ${Math.round(weekHours * 10) / 10} h esta semana (límite ${worker.weeklyHoursLimit} h)`,
    });
  }

  if (shift.vehicleLicence) {
    const crew = [...(input.crewOnShift ?? []).filter((w) => w.id !== worker.id), worker];
    if (!crew.some((w) => canDrive(w.skills, shift.vehicleLicence!))) {
      out.push({
        code: "sin_conductor",
        severity: "warning",
        message: `El turno no tiene conductor con ${SKILL_LABELS[shift.vehicleLicence as Skill] ?? shift.vehicleLicence}`,
      });
    }
  }
  return out;
}

export const hasBlockingConflict = (c: Conflict[]) => c.some((x) => x.severity === "error");

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type Suggestion = { worker: WorkerInfo; score: number; reasons: string[]; conflicts: Conflict[] };

/**
 * Ranks workers for a shift: no blocking conflicts, required skills,
 * fewer accumulated hours this week, closer to the site.
 */
export function suggestCrew(input: { shift: ShiftInfo; workers: WorkerInfo[]; existing: ExistingAssignment[]; size: number }): Suggestion[] {
  const ws = weekStart(input.shift.start);
  const ranked = input.workers.map((worker) => {
    const conflicts = checkAssignment({ worker, shift: input.shift, existing: input.existing });
    const reasons: string[] = [];
    let score = 100;
    if (hasBlockingConflict(conflicts)) score -= 1000;
    const skillHits = input.shift.requiredSkills.filter((s) => worker.skills.includes(s)).length;
    score += skillHits * 20;
    if (skillHits) reasons.push(`${skillHits} habilidad${skillHits > 1 ? "es" : ""} requerida${skillHits > 1 ? "s" : ""}`);
    score -= conflicts.filter((c) => c.severity === "warning").length * 15;
    const hours = input.existing
      .filter((a) => a.workerId === worker.id && a.shift.start >= ws && a.shift.start < ws + 7 * 24 * HOUR)
      .reduce((s, a) => s + (a.shift.end - a.shift.start) / HOUR, 0);
    score -= hours;
    reasons.push(`${Math.round(hours)} h esta semana`);
    if (worker.home && input.shift.location) {
      const km = distanceKm(worker.home, input.shift.location);
      score -= km / 5;
      reasons.push(`a ${Math.round(km)} km`);
    }
    return { worker, score: Math.round(score * 10) / 10, reasons, conflicts };
  });
  return ranked.sort((a, b) => b.score - a.score).slice(0, Math.max(input.size, 0) || ranked.length);
}

export type PhaseKind = "carga" | "transporte" | "montaje" | "evento" | "desmontaje" | "retorno";
/** Labels for project phases and shift phases ("otro" exists only on manual shifts). */
export const PHASE_LABELS: Record<PhaseKind | "otro", string> = {
  carga: "Carga",
  transporte: "Transporte",
  montaje: "Montaje",
  evento: "Evento",
  desmontaje: "Desmontaje",
  retorno: "Retorno",
  otro: "Otro",
};

/** Crew need for a project phase derived from estimated person-hours. */
export function shiftNeed(phase: PhaseKind, personHours: number, minPeople: number, phaseHours: number) {
  if (phase === "evento") return { people: 0, requiredSkills: [] as string[] };
  const hours = Math.max(1, phaseHours);
  const people = Math.max(phase === "transporte" ? 1 : minPeople, Math.ceil(personHours / hours));
  const requiredSkills =
    phase === "transporte" || phase === "retorno" ? ["conductor_c"] : phase === "carga" ? ["carretillero"] : ["jefe_equipo", "montador"];
  return { people: Math.min(people, 20), requiredSkills };
}
