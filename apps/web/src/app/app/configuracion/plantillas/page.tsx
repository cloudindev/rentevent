import Link from "next/link";
import { asc, emailTemplates, tenantSettings } from "@rentevent/db";
import { PageBody } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { tenantDb } from "@/server/context";
import { TermsForm } from "./terms-form";

export const metadata = { title: "Plantillas de documentos" };

export default async function TemplatesPage() {
  const d = await tenantDb(async (tx) => ({ s: (await tx.select().from(tenantSettings))[0], templates: await tx.select().from(emailTemplates).orderBy(asc(emailTemplates.name)) }), "configuracion");
  return (
    <PageBody className="max-w-4xl">
      <TermsForm quoteTerms={d.s?.quoteTerms ?? ""} quoteValidityDays={d.s?.quoteValidityDays ?? 30} />
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Plantillas de correo</CardTitle>
            <CardDescription>Variables disponibles: {"{{cliente}} {{evento}} {{pedido}} {{enlace}} {{montaje}} {{retorno}} {{empresa}} {{trabajador}}"}</CardDescription>
          </div>
          <Link href="/app/emails?tab=plantillas" className="text-sm text-link hover:underline">Editar en Emails</Link>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {d.templates.map((t) => (
              <li key={t.id} className="py-2.5">
                <p className="font-medium">{t.name} <span className="font-mono text-xs text-muted-foreground">{t.key}</span></p>
                <p className="truncate text-muted-foreground">{t.subject}</p>
              </li>
            ))}
            {d.templates.length === 0 && <li className="py-4 text-muted-foreground">Sin plantillas.</li>}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Documentos PDF</CardTitle>
            <CardDescription>Presupuestos, facturas, albaranes y certificados usan tu logotipo, color de marca y datos fiscales de la pestaña Empresa.</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </PageBody>
  );
}
