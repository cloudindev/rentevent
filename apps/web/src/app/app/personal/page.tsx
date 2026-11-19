import { HardHat } from "lucide-react";
import { asc, gt, workerUnavailability, workers } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PersonalTabs } from "@/components/crew/personal-tabs";
import { can, canSeeField } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { WorkersList } from "./workers-list";
import { nowMs } from "@/server/crew/hours";

export const metadata = { title: "Personal" };

export default async function PersonalPage() {
  const data = await tenantDb(async (tx, ctx) => {
    const ws = await tx.select().from(workers).orderBy(asc(workers.name));
    const unav = await tx.select().from(workerUnavailability).where(gt(workerUnavailability.endsAt, new Date()));
    return { ws, unav, ctx };
  });
  const showCost = canSeeField(data.ctx.role, "coste_hora", data.ctx.fieldPermissions);
  const now = nowMs();
  const rows = data.ws.map((w) => {
    const current = data.unav.find((u) => u.workerId === w.id && u.startsAt.getTime() <= now && u.endsAt.getTime() > now);
    return {
      id: w.id,
      name: w.name,
      email: w.email ?? "",
      phone: w.phone ?? "",
      type: w.type as "plantilla" | "eventual" | "autonomo",
      skills: w.skills,
      trainingExpiresAt: w.trainingExpiresAt ?? "",
      costPerHour: showCost ? Number(w.costPerHour) : 0,
      weeklyHoursLimit: w.weeklyHoursLimit,
      address: w.address ?? "",
      color: w.color ?? "#2563eb",
      active: w.active,
      linked: Boolean(w.userId),
      absence: current ? { kind: current.kind, until: current.endsAt.toISOString() } : null,
      upcoming: data.unav.filter((u) => u.workerId === w.id).length,
    };
  });
  return (
    <>
      <PageHeader icon={HardHat} title="Personal" subtitle={`${rows.filter((r) => r.active).length} activos`} />
      <PersonalTabs />
      <PageBody>
        <WorkersList rows={rows} showCost={showCost} canEdit={can(data.ctx.role, "personal")} />
      </PageBody>
    </>
  );
}
