import { Rocket } from "lucide-react";
import { eq, organization, structureFamilies, sql, systemDb, tenantSettings } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/permissions";
import { requireApp, tenantDb } from "@/server/context";
import { Wizard } from "./wizard";

export const metadata = { title: "Configura tu empresa" };

export default async function OnboardingPage() {
  const ctx = await requireApp("configuracion");
  const d = await tenantDb(async (tx) => ({
    s: (await tx.select().from(tenantSettings))[0],
    families: (await tx.select({ n: sql<number>`count(*)::int`, pending: sql<number>`count(*) filter (where ${structureFamilies.parametersPending})::int` }).from(structureFamilies))[0]!,
  }));
  const [org] = await systemDb().select().from(organization).where(eq(organization.id, ctx.tenantId));
  const s = d.s;
  return (
    <>
      <PageHeader icon={Rocket} title="Configura tu empresa" subtitle="6 pasos · puedes saltar cualquiera y volver después" />
      <PageBody className="max-w-4xl">
        <Wizard
          initialStep={s?.onboardingDone ? 0 : Math.min(5, s?.onboardingStep ?? 0)}
          slug={ctx.slug}
          company={{
            name: org?.name ?? ctx.tenantName,
            legalName: s?.legalName ?? "",
            taxId: s?.taxId ?? "",
            address: s?.address ?? "",
            city: s?.city ?? "",
            province: s?.province ?? "",
            postalCode: s?.postalCode ?? "",
            phone: s?.phone ?? "",
            email: s?.email ?? "",
            website: s?.website ?? "",
            iban: s?.iban ?? "",
            brandColor: s?.brandColor ?? "#F95F40",
            availabilityMarginMinutes: s?.availabilityMarginMinutes ?? 60,
            optionExpiryDays: s?.optionExpiryDays ?? 7,
            quoteValidityDays: s?.quoteValidityDays ?? 30,
            quoteTerms: s?.quoteTerms ?? "",
          }}
          logoUrl={s?.logoUrl ?? null}
          familyCount={d.families.n}
          pendingFamilies={d.families.pending}
          canImport={{ inventario: can(ctx.role, "inventario"), contactos: can(ctx.role, "comercial"), proyectos: can(ctx.role, "comercial") }}
        />
      </PageBody>
    </>
  );
}
