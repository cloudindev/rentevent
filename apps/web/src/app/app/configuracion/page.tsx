import Link from "next/link";
import { eq, organization, systemDb, tenantSettings } from "@rentevent/db";
import { PageBody } from "@/components/app/page-header";
import { can } from "@/lib/permissions";
import { requireApp, tenantDb } from "@/server/context";
import { CompanyForm } from "./company-form";

export const metadata = { title: "Configuración" };

export default async function CompanySettingsPage() {
  const ctx = await requireApp();
  if (!can(ctx.role, "configuracion"))
    return (
      <PageBody className="max-w-xl">
        <p className="text-sm text-muted-foreground">
          La configuración de la empresa solo está disponible para administradores. Puedes cambiar tus datos y tu seguridad en <Link className="text-link underline" href="/app/perfil">tu perfil</Link>.
        </p>
      </PageBody>
    );
  const s = await tenantDb(async (tx) => (await tx.select().from(tenantSettings))[0] ?? null);
  const [org] = await systemDb().select({ name: organization.name, slug: organization.slug }).from(organization).where(eq(organization.id, ctx.tenantId));
  return (
    <PageBody className="max-w-4xl">
      <CompanyForm
        slug={org?.slug ?? ctx.slug}
        initial={{
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
        base={s?.baseLat != null && s?.baseLng != null ? { lat: s.baseLat, lng: s.baseLng } : null}
      />
    </PageBody>
  );
}
