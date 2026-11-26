import { LayoutTemplate, Tent } from "lucide-react";
import { desc, tentTemplates } from "@rentevent/db";
import type { Composition } from "@rentevent/core";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty";
import { loadCatalog } from "@/server/catalog";
import { tenantDb } from "@/server/context";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { CarpasTabs } from "../tabs";
import { TemplateActions } from "./template-actions";

export const metadata = { title: "Plantillas de carpa" };

export default async function TemplatesPage() {
  const { templates, cat, canUse } = await tenantDb(async (tx, ctx) => ({ templates: await tx.select().from(tentTemplates).orderBy(desc(tentTemplates.createdAt)), cat: await loadCatalog(tx, { includeInactive: true }), canUse: can(ctx.role, "comercial") }));
  const famName = (id: string) => cat.families.find((f) => f.id === id);
  return (
    <>
      <PageHeader icon={Tent} title="Carpas" />
      <CarpasTabs />
      <PageBody>
        {templates.length === 0 ? (
          <EmptyState icon={LayoutTemplate} title="Sin plantillas" description="Guarda una configuración frecuente desde el configurador de un pedido para reutilizarla." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => {
              const comp = t.composition as Composition;
              return (
                <article key={t.id} className="rounded-xl border bg-card p-4">
                  <h3 className="font-semibold">{t.name}</h3>
                  {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
                  <ul className="mt-3 space-y-1 text-sm">
                    {comp.tents.map((x) => {
                      const f = famName(x.config.familyId);
                      return (
                        <li key={x.id}>
                          {x.label || f?.name} · {f ? `${f.width}x${x.config.modules * f.moduleLength}` : "familia eliminada"}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</span>
                    {canUse && <TemplateActions id={t.id} />}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}
