import { Workflow } from "lucide-react";
import { asc, desc, emailTemplates, workflowRuns, workflows } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { ACTIONS, normalizeTrigger, TRIGGERS, type WorkflowAction } from "@/server/workflows";
import type { Condition } from "@/server/workflows/logic";
import { WorkflowList } from "./workflow-list";

export const metadata = { title: "Workflows" };

export default async function WorkflowsPage() {
  const d = await tenantDb(async (tx, ctx) => ({
    list: await tx.select().from(workflows).orderBy(asc(workflows.name)),
    runs: await tx.select().from(workflowRuns).orderBy(desc(workflowRuns.createdAt)).limit(60),
    templates: await tx.select({ key: emailTemplates.key, name: emailTemplates.name }).from(emailTemplates).orderBy(asc(emailTemplates.name)),
    role: ctx.role,
  }));
  const items = d.list.map((w) => ({
    id: w.id,
    name: w.name,
    trigger: normalizeTrigger(w.trigger),
    conditions: (w.conditions as Condition[]) ?? [],
    action: w.action as WorkflowAction,
    active: w.active,
    lastRunAt: w.lastRunAt?.toISOString() ?? null,
  }));
  const runs = d.runs.map((r) => ({ id: r.id, workflowId: r.workflowId, status: r.status, detail: r.detail, entityId: r.entityId, createdAt: r.createdAt.toISOString() }));
  return (
    <>
      <PageHeader icon={Workflow} title="Workflows" subtitle="Automatizaciones con disparador, condición y acción" />
      <PageBody>
        {items.length === 0 && !can(d.role, "automatizaciones") ? (
          <EmptyState icon={Workflow} title="No hay automatizaciones" />
        ) : (
          <WorkflowList workflows={items} runs={runs} templates={d.templates} canEdit={can(d.role, "automatizaciones")} triggers={TRIGGERS} actions={ACTIONS} />
        )}
      </PageBody>
    </>
  );
}
