import { Truck } from "lucide-react";
import { and, asc, assignments, eq, gt, inArray, lt, orders, projects, shifts, tentConfigurations, vehicles, venues, workers } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { madridMidnight, shiftKey } from "@/server/crew/board";
import { madridDay } from "@/server/crew/hours";
import { TransportView } from "./transport-view";

export const metadata = { title: "Transporte" };

export default async function TransportPage({ searchParams }: { searchParams: Promise<{ fecha?: string; tab?: string }> }) {
  const sp = await searchParams;
  const day = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : madridDay(new Date());
  const from = new Date(madridMidnight(day));
  const to = new Date(madridMidnight(shiftKey(day, 1)));
  const data = await tenantDb(async (tx, ctx) => {
    const fleet = await tx.select().from(vehicles).orderBy(asc(vehicles.name));
    const sh = await tx
      .select({ s: shifts, project: projects.name, orderNumber: orders.number, orderTitle: orders.title, venue: venues.name, venueCity: venues.city, maxVehicle: venues.maxVehicle })
      .from(shifts)
      .leftJoin(projects, eq(projects.id, shifts.projectId))
      .leftJoin(orders, eq(orders.id, shifts.orderId))
      .leftJoin(venues, eq(venues.id, projects.venueId))
      .where(and(inArray(shifts.phaseKind, ["transporte", "retorno", "carga"]), lt(shifts.startsAt, to), gt(shifts.endsAt, from)))
      .orderBy(asc(shifts.startsAt));
    const ids = sh.map((x) => x.s.id);
    const orderIds = [...new Set(sh.map((x) => x.s.orderId).filter(Boolean))] as string[];
    const [crew, configs] = await Promise.all([
      ids.length ? tx.select({ shiftId: assignments.shiftId, status: assignments.status, name: workers.name, skills: workers.skills }).from(assignments).innerJoin(workers, eq(workers.id, assignments.workerId)).where(inArray(assignments.shiftId, ids)) : [],
      orderIds.length ? tx.select({ orderId: tentConfigurations.orderId, metrics: tentConfigurations.metrics }).from(tentConfigurations).where(inArray(tentConfigurations.orderId, orderIds)) : [],
    ]);
    return { fleet, sh, crew, configs, canEdit: can(ctx.role, "transporte") };
  });
  const load = new Map<string, { weightKg: number; volumeM3: number }>();
  for (const c of data.configs) {
    const t = ((c.metrics ?? {}) as { totals?: { weightKg?: number; volumeM3?: number } }).totals ?? {};
    const x = load.get(c.orderId) ?? { weightKg: 0, volumeM3: 0 };
    x.weightKg += t.weightKg ?? 0;
    x.volumeM3 += t.volumeM3 ?? 0;
    load.set(c.orderId, x);
  }
  return (
    <>
      <PageHeader icon={Truck} title="Transporte" subtitle={`${data.fleet.filter((v) => v.active).length} vehículos activos`} />
      <PageBody>
        <TransportView
          day={day}
          tab={sp.tab === "vehiculos" ? "vehiculos" : "rutas"}
          canEdit={data.canEdit}
          fleet={data.fleet.map((v) => ({ id: v.id, name: v.name, plate: v.plate, kind: v.kind as "camion", maxPayloadKg: v.maxPayloadKg, volumeM3: v.volumeM3, licenceRequired: v.licenceRequired as "conductor_c", itvUntil: v.itvUntil ?? "", costPerKm: Number(v.costPerKm), active: v.active }))}
          trips={data.sh.map(({ s, project, orderNumber, orderTitle, venue, venueCity, maxVehicle }) => ({
            id: s.id,
            phase: s.phaseKind,
            title: s.title,
            start: s.startsAt.toISOString(),
            end: s.endsAt.toISOString(),
            project,
            order: orderNumber ? `${orderNumber} · ${orderTitle}` : null,
            destination: venue ? `${venue}${venueCity ? `, ${venueCity}` : ""}` : (s.address ?? null),
            maxVehicle,
            lat: s.lat,
            lng: s.lng,
            vehicleId: s.vehicleId,
            load: s.orderId ? (load.get(s.orderId) ?? null) : null,
            crew: data.crew.filter((c) => c.shiftId === s.id && c.status !== "rechazado").map((c) => ({ name: c.name, skills: c.skills })),
            notes: s.notes,
          }))}
        />
      </PageBody>
    </>
  );
}
