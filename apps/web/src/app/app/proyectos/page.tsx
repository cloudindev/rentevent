import { Briefcase } from "lucide-react";
import { asc, contacts, desc, eq, projects, sql, venues } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { loadViews } from "@/server/views";
import { ProjectsTable } from "./projects-table";

export const metadata = { title: "Proyectos" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  const sp = await searchParams;
  const d = await tenantDb(async (tx, ctx) => ({
    rows: await tx
      .select({
        id: projects.id,
        number: projects.number,
        name: projects.name,
        status: projects.status,
        startsAt: projects.startsAt,
        endsAt: projects.endsAt,
        client: contacts.name,
        orders: sql<number>`(select count(*)::int from orders o where o.project_id = ${projects.id})`,
        value: sql<number>`(select coalesce(sum(q.total),0)::float from quotes q where q.order_id in (select id from orders o where o.project_id = ${projects.id} and o.status <> 'cancelado') and q.version = (select max(version) from quotes q2 where q2.order_id = q.order_id))`,
      })
      .from(projects)
      .leftJoin(contacts, eq(contacts.id, projects.clientId))
      .orderBy(desc(projects.startsAt)),
    clients: await tx.select({ id: contacts.id, name: contacts.name }).from(contacts).where(eq(contacts.kind, "cliente")).orderBy(asc(contacts.name)),
    venues: await tx.select({ id: venues.id, name: venues.name }).from(venues).orderBy(asc(venues.name)),
    views: await loadViews(tx, ctx.user.id, "projects"),
    role: ctx.role,
  }));
  return (
    <>
      <PageHeader icon={Briefcase} title="Proyectos" subtitle={`${d.rows.length} proyectos`} />
      <PageBody>
        <ProjectsTable
          rows={d.rows.map((r) => ({ ...r, client: r.client ?? "", startsAt: r.startsAt?.toISOString() ?? null, endsAt: r.endsAt?.toISOString() ?? null, value: Number(r.value) }))}
          views={d.views}
          clients={d.clients}
          venues={d.venues}
          canCreate={can(d.role, "comercial")}
          openNew={sp.nuevo === "1"}
        />
      </PageBody>
    </>
  );
}
