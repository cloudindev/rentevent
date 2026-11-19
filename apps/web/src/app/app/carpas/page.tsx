import Link from "next/link";
import { Tent, TriangleAlert } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/permissions";
import { formatEUR } from "@/lib/utils";
import { loadCatalog } from "@/server/catalog";
import { tenantDb } from "@/server/context";
import { eq, tenantSettings } from "@rentevent/db";
import { CarpasTabs } from "./tabs";
import { NewFamilyButton } from "./new-family";

export const metadata = { title: "Carpas" };

export default async function CarpasPage() {
  const { cat, ctx, wizardDone } = await tenantDb(async (tx, ctx) => {
    const cat = await loadCatalog(tx, { includeInactive: true });
    const [s] = await tx.select({ w: tenantSettings.manufacturerWizardDone }).from(tenantSettings).where(eq(tenantSettings.tenantId, ctx.tenantId));
    return { cat, ctx, wizardDone: s?.w ?? false };
  });
  const itemById = new Map(cat.items.map((i) => [i.id, i]));
  const families = cat.families.filter((f) => f.active);
  const pending = families.filter((f) => f.parametersPending).length;
  return (
    <>
      <PageHeader icon={Tent} title="Carpas">
        {can(ctx.role, "carpas") && <NewFamilyButton />}
      </PageHeader>
      <CarpasTabs />
      <PageBody>
        {pending > 0 && !wizardDone && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm">
            <TriangleAlert className="size-4 text-warning" />
            <span className="flex-1">
              {pending} familia{pending > 1 ? "s tienen" : " tiene"} cantidades por pórtico de ejemplo (pesos, correas, estacas). Valídalas con los datos de tu fabricante.
            </span>
            <Button asChild size="sm" variant="outline">
              <Link href="/app/carpas/asistente">Abrir asistente</Link>
            </Button>
          </div>
        )}
        {families.length === 0 ? (
          <EmptyState icon={Tent} title="Aún no hay familias de carpa" description="Crea tu primera familia (ancho, altura, módulo y cercha) o carga la plantilla de ejemplo desde el asistente de alta." action={can(ctx.role, "carpas") ? <NewFamilyButton /> : undefined} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Familia</TH>
                <TH>Medidas</TH>
                <TH>Cubierta</TH>
                <TH>Cercha</TH>
                <TH className="text-right">Stock cerchas</TH>
                <TH className="text-right">Largo máx.</TH>
                <TH className="text-right">Reglas</TH>
                <TH className="text-right">Tarifa</TH>
                <TH>Estado</TH>
              </TR>
            </THead>
            <TBody>
              {families.map((f) => {
                const truss = f.trussItemId ? itemById.get(f.trussItemId) : null;
                const rules = cat.rules.filter((r) => r.familyId === f.id).length;
                const shared = truss ? families.filter((x) => x.trussItemId === truss.id).length > 1 : false;
                return (
                  <TR key={f.id}>
                    <TD>
                      <Link href={`/app/carpas/${f.id}`} className="font-medium hover:underline">
                        {f.name}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">{f.code}</span>
                    </TD>
                    <TD className="tabular">
                      {f.width} m · módulo {f.moduleLength} m · {f.eaveHeight}/{f.ridgeHeight} m
                    </TD>
                    <TD>{f.roofShape === "dos_aguas" ? "Dos aguas" : f.roofShape === "poligonal" ? "Poligonal" : "Jaima"} · pata {f.heightClass}</TD>
                    <TD>
                      {truss ? truss.sku : "—"}
                      {shared && <span className="ml-1.5 text-xs text-muted-foreground">(compartida)</span>}
                    </TD>
                    <TD className="tabular text-right">{truss ? truss.stockTotal - truss.stockRepair : "—"}</TD>
                    <TD className="tabular text-right">{f.roofShape === "jaima" ? "5x5" : `${f.maxModules * f.moduleLength} m`}</TD>
                    <TD className="tabular text-right">{rules}</TD>
                    <TD className="tabular text-right">{f.price ? `${formatEUR(f.price)}/${f.priceMode === "m2" ? "m²" : "ml"}` : "—"}</TD>
                    <TD>{f.parametersPending ? <StatusPill tone="warning">Pendiente validar</StatusPill> : <StatusPill tone="success">Validada</StatusPill>}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </PageBody>
    </>
  );
}
