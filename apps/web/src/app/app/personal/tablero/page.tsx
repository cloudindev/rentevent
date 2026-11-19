import { HardHat } from "lucide-react";
import { asc, projects } from "@rentevent/db";
import { PageHeader } from "@/components/app/page-header";
import { PersonalTabs } from "@/components/crew/personal-tabs";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { loadCrewWindow } from "@/server/crew/data";
import { madridDay } from "@/server/crew/hours";
import { weekRange } from "@/server/crew/board";
import { Board, type BoardData } from "@/components/crew/board";

export const metadata = { title: "Tablero de personal" };

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ fecha?: string; modo?: string; vista?: string }> }) {
  const sp = await searchParams;
  const anchor = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : madridDay(new Date());
  const mode = sp.modo === "dia" ? "dia" : "semana";
  const view = sp.vista === "proyecto" || sp.vista === "cuadrilla" ? sp.vista : "trabajador";
  const range = weekRange(anchor, mode);
  const data = await tenantDb(async (tx, ctx) => {
    const win = await loadCrewWindow(tx, new Date(range.start), new Date(range.end));
    const projs = await tx.select({ id: projects.id, name: projects.name, color: projects.color, status: projects.status }).from(projects).orderBy(asc(projects.name));
    return { win, projs, ctx };
  }, "ver");
  const { win } = data;
  const board: BoardData = {
    anchor,
    mode,
    view,
    range,
    canEdit: can(data.ctx.role, "personal"),
    isAdmin: data.ctx.role === "administrador",
    workers: win.workers.map((w) => ({ id: w.id, name: w.name, color: w.color, skills: w.skills, trainingExpiresAt: w.trainingExpiresAt, weeklyHoursLimit: w.weeklyHoursLimit, type: w.type })),
    workerInfos: win.workerInfos,
    shifts: win.shifts.map(({ shift: s, projectName, projectColor, orderNumber }) => ({
      id: s.id,
      title: s.title,
      phaseKind: s.phaseKind,
      projectId: s.projectId,
      projectName,
      projectColor,
      orderNumber,
      start: s.startsAt.getTime(),
      end: s.endsAt.getTime(),
      requiredPeople: s.requiredPeople,
      requiredSkills: s.requiredSkills,
      vehicleId: s.vehicleId,
      vehicleLicence: win.licenceOf(s),
      published: s.published,
      address: s.address,
      notes: s.notes,
      location: s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : null,
    })),
    assignments: win.assignments.map((a) => ({ shiftId: a.shiftId, workerId: a.workerId, status: a.status, overrideReason: a.overrideReason })),
    vehicles: win.vehicles.map((v) => ({ id: v.id, name: v.name, licence: v.licenceRequired, maxPayloadKg: v.maxPayloadKg })),
    projects: data.projs.filter((p) => p.status !== "cancelado"),
  };
  return (
    <div className="flex h-full flex-col">
      <PageHeader icon={HardHat} title="Personal" subtitle="Tablero de planificación" />
      <PersonalTabs />
      <Board data={board} />
    </div>
  );
}
