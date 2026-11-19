import { Users } from "lucide-react";
import { asc, contacts, sql } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { loadViews } from "@/server/views";
import { ContactsTable } from "./contacts-table";

export const metadata = { title: "Contactos" };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  const sp = await searchParams;
  const d = await tenantDb(async (tx, ctx) => {
    const rows = await tx
      .select({
        id: contacts.id,
        kind: contacts.kind,
        name: contacts.name,
        taxId: contacts.taxId,
        email: contacts.email,
        phone: contacts.phone,
        archived: contacts.archived,
        city: sql<string>`(select city from contact_addresses a where a.contact_id = ${contacts.id} order by is_default desc limit 1)`,
        orders: sql<number>`(select count(*)::int from orders o where o.client_id = ${contacts.id})`,
      })
      .from(contacts)
      .orderBy(asc(contacts.name));
    return { rows, views: await loadViews(tx, ctx.user.id, "contacts"), role: ctx.role };
  });
  return (
    <>
      <PageHeader icon={Users} title="Contactos" subtitle={`${d.rows.length} registros`} />
      <PageBody>
        <ContactsTable rows={d.rows.map((r) => ({ ...r, city: r.city ?? "", taxId: r.taxId ?? "", email: r.email ?? "", phone: r.phone ?? "" }))} views={d.views} canEdit={can(d.role, "comercial")} openNew={sp.nuevo === "1"} />
      </PageBody>
    </>
  );
}
