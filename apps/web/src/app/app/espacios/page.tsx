import { MapPin } from "lucide-react";
import { asc, contacts, count, eq, projects, venues } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { VenuesList } from "./venues-list";

export const metadata = { title: "Espacios" };

export default async function VenuesPage() {
  const data = await tenantDb(async (tx, ctx) => {
    const rows = await tx.select().from(venues).orderBy(asc(venues.name));
    const usage = await tx.select({ venueId: projects.venueId, n: count() }).from(projects).groupBy(projects.venueId);
    const clients = await tx.select({ id: contacts.id, name: contacts.name }).from(contacts).where(eq(contacts.archived, false)).orderBy(asc(contacts.name));
    return { rows, usage, clients, canEdit: can(ctx.role, "comercial") };
  });
  return (
    <>
      <PageHeader icon={MapPin} title="Espacios" subtitle={`${data.rows.length} recintos`} />
      <PageBody>
        <VenuesList
          canEdit={data.canEdit}
          contacts={data.clients}
          rows={data.rows.map((v) => ({
            id: v.id,
            name: v.name,
            address: v.address,
            city: v.city,
            contactId: v.contactId,
            groundType: v.groundType as "cesped",
            anchoringAllowed: v.anchoringAllowed,
            accessNotes: v.accessNotes ?? "",
            restrictions: v.restrictions ?? "",
            maxVehicle: v.maxVehicle ?? "",
            metresPerPixel: v.metresPerPixel,
            geocoded: v.lat != null,
            hasPlan: Boolean(v.planImageUrl),
            projects: data.usage.find((u) => u.venueId === v.id)?.n ?? 0,
          }))}
        />
      </PageBody>
    </>
  );
}
