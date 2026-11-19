import "server-only";
import { and, eq, inArray, ne, orders, projectPhases, projects, shifts, structureFamilies, tentConfigurations, vehicles, venues, type Tx } from "@rentevent/db";
import { PHASE_LABELS, shiftNeed, vehiclesFor, type Composition, type PhaseKind } from "@rentevent/core";

type Metrics = { labor?: { montajeHoras?: number; desmontajeHoras?: number; personas?: number }; totals?: { weightKg?: number; volumeM3?: number } };

const CHECKLISTS: Record<string, string[]> = {
  carga: ["Lista de carga revisada", "Material escaneado", "Camión cerrado y estibado"],
  transporte: ["Documentación del vehículo", "Carga asegurada"],
  montaje: ["Replanteo y nivelación", "Montaje de pórticos", "Lonas de techo", "Laterales y frentes", "Lastre o anclajes revisados", "Fotos finales", "Firma del cliente"],
  desmontaje: ["Fotos iniciales", "Recuento de material", "Daños anotados", "Zona limpia"],
  retorno: ["Descarga en nave", "Material a limpieza o reparación"],
};

/**
 * Creates the crew shifts of a project from its phases and the labour
 * estimate of its tent BOMs (person-hours). Idempotent per phase: a phase
 * that already has shifts is skipped. Returns the created shift ids.
 */
export async function generateShiftsForProject(tx: Tx, projectId: string): Promise<{ created: string[]; skipped: PhaseKind[] }> {
  const [project] = await tx.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw new Error("Proyecto no encontrado");
  const [venue] = project.venueId ? await tx.select().from(venues).where(eq(venues.id, project.venueId)) : [];
  const phases = await tx.select().from(projectPhases).where(eq(projectPhases.projectId, projectId));
  const ords = await tx.select().from(orders).where(and(eq(orders.projectId, projectId), ne(orders.status, "cancelado")));
  const orderIds = ords.map((o) => o.id);
  const configs = orderIds.length ? await tx.select().from(tentConfigurations).where(inArray(tentConfigurations.orderId, orderIds)) : [];
  const existing = await tx.select({ phaseKind: shifts.phaseKind }).from(shifts).where(eq(shifts.projectId, projectId));
  const done = new Set(existing.map((e) => e.phaseKind));

  let montaje = 0;
  let desmontaje = 0;
  let weight = 0;
  let volume = 0;
  const familyIds = new Set<string>();
  for (const c of configs) {
    const m = (c.metrics ?? {}) as Metrics;
    montaje += m.labor?.montajeHoras ?? 0;
    desmontaje += m.labor?.desmontajeHoras ?? 0;
    weight += m.totals?.weightKg ?? 0;
    volume += m.totals?.volumeM3 ?? 0;
    for (const t of (c.composition as Composition).tents ?? []) familyIds.add(t.config.familyId);
  }
  const fams = familyIds.size ? await tx.select().from(structureFamilies).where(inArray(structureFamilies.id, [...familyIds])) : [];
  const minPeople = Math.max(2, ...fams.map((f) => Number((f.labor as { personasMinimas?: number })?.personasMinimas ?? 2)));
  const fleet = await tx.select().from(vehicles).where(eq(vehicles.active, true));
  const best = vehiclesFor(weight, volume, fleet.map((v) => ({ id: v.id, name: v.name, maxPayloadKg: v.maxPayloadKg, volumeM3: v.volumeM3 })))[0];
  const vehicle = best ? fleet.find((v) => v.id === best.vehicleId) : undefined;

  const personHours: Partial<Record<PhaseKind, number>> = {
    carga: Math.max(2, Math.round(montaje * 0.15 * 10) / 10),
    montaje,
    desmontaje,
    retorno: Math.max(2, Math.round(desmontaje * 0.2 * 10) / 10),
  };

  const created: string[] = [];
  const skipped: PhaseKind[] = [];
  const orderId = ords[0]?.id ?? null;
  for (const ph of phases) {
    const kind = ph.kind as PhaseKind;
    if (kind === "evento") continue;
    if (done.has(kind)) {
      skipped.push(kind);
      continue;
    }
    const phaseHours = (ph.endsAt.getTime() - ph.startsAt.getTime()) / 3_600_000;
    const ph_ = kind === "transporte" ? Math.max(1, phaseHours) * (best?.count ?? 1) : (personHours[kind] ?? phaseHours * 2);
    const need = shiftNeed(kind, ph_, kind === "transporte" ? 1 : kind === "carga" || kind === "retorno" ? 2 : minPeople, phaseHours);
    const skills = kind === "transporte" || kind === "retorno" ? [vehicle?.licenceRequired ?? need.requiredSkills[0]!, ...(kind === "retorno" ? ["montador"] : [])] : need.requiredSkills;
    const [row] = await tx
      .insert(shifts)
      .values({
        projectId,
        orderId,
        phaseKind: kind,
        title: `${PHASE_LABELS[kind]} · ${project.name}`,
        startsAt: ph.startsAt,
        endsAt: ph.endsAt,
        requiredPeople: need.people,
        requiredSkills: [...new Set(skills)],
        estimatedHours: Math.round(ph_ * 10) / 10,
        vehicleId: kind === "carga" ? null : (vehicle?.id ?? null),
        address: venue ? `${venue.name}${venue.city ? `, ${venue.city}` : ""}` : project.locationAddress,
        lat: venue?.lat ?? project.lat,
        lng: venue?.lng ?? project.lng,
        notes: kind === "transporte" && best && best.count > 1 ? `Se necesitan ${best.count} viajes de ${best.name}` : null,
        checklist: CHECKLISTS[kind] ?? [],
      })
      .returning({ id: shifts.id });
    created.push(row!.id);
  }
  return { created, skipped };
}
