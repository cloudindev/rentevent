import { Wrench } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { inspectionPlan } from "@/server/warehouse/maintenance";
import { MaintenanceTabs } from "../tabs";
import { InspectionList } from "./inspection-list";

export const metadata = { title: "Revisiones" };

export default async function InspectionsPage() {
  const d = await tenantDb(async (tx, ctx) => ({ plan: await inspectionPlan(tx), canEdit: can(ctx.role, "mantenimiento") }));
  const rows = d.plan.map((r) => ({ ...r, last: r.last?.toISOString() ?? null, nextDue: r.nextDue?.toISOString() ?? null }));
  return (
    <>
      <PageHeader icon={Wrench} title="Mantenimiento" subtitle="Revisiones periódicas" />
      <MaintenanceTabs />
      <PageBody>
        <InspectionList rows={rows} canEdit={d.canEdit} />
      </PageBody>
    </>
  );
}
