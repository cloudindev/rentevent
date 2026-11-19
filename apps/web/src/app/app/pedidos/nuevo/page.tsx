import { ListChecks } from "lucide-react";
import { asc, contacts, eq, projects, tentTemplates, venues } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { loadCatalog } from "@/server/catalog";
import { tenantDb } from "@/server/context";
import { NewOrderForm } from "./new-order-form";

export const metadata = { title: "Nuevo pedido" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ plantilla?: string; proyecto?: string }> }) {
  const sp = await searchParams;
  const d = await tenantDb(
    async (tx) => ({
      clients: await tx.select({ id: contacts.id, name: contacts.name }).from(contacts).where(eq(contacts.kind, "cliente")).orderBy(asc(contacts.name)),
      venues: await tx.select({ id: venues.id, name: venues.name }).from(venues).orderBy(asc(venues.name)),
      templates: await tx.select({ id: tentTemplates.id, name: tentTemplates.name }).from(tentTemplates).orderBy(asc(tentTemplates.name)),
      projects: await tx.select({ id: projects.id, name: projects.name, number: projects.number }).from(projects).orderBy(asc(projects.name)),
      families: (await loadCatalog(tx)).families.map((f) => ({ id: f.id, name: f.name })),
    }),
    "comercial",
  );
  return (
    <>
      <PageHeader icon={ListChecks} title="Nuevo pedido" back={{ href: "/app/pedidos", label: "Pedidos" }} />
      <PageBody className="max-w-3xl">
        <NewOrderForm {...d} templateId={sp.plantilla ?? null} projectId={sp.proyecto ?? null} />
      </PageBody>
    </>
  );
}
