import { ListChecks } from "lucide-react";
import { contacts, desc, eq, orders, projects, quotes, sql } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { loadViews } from "@/server/views";
import { OrdersTable } from "./orders-table";

export const metadata = { title: "Pedidos" };

export default async function OrdersPage() {
  const d = await tenantDb(async (tx, ctx) => {
    const rows = await tx
      .select({
        id: orders.id,
        number: orders.number,
        title: orders.title,
        status: orders.status,
        periodStart: orders.periodStart,
        periodEnd: orders.periodEnd,
        client: contacts.name,
        project: projects.name,
        projectId: projects.id,
        total: sql<number>`(select q.total from ${quotes} q where q.order_id = ${orders.id} order by q.version desc limit 1)`,
      })
      .from(orders)
      .leftJoin(contacts, eq(contacts.id, orders.clientId))
      .leftJoin(projects, eq(projects.id, orders.projectId))
      .orderBy(desc(orders.periodStart));
    return { rows, views: await loadViews(tx, ctx.user.id, "orders"), role: ctx.role };
  });
  return (
    <>
      <PageHeader icon={ListChecks} title="Pedidos" subtitle={`${d.rows.length} pedidos`} />
      <PageBody>
        <OrdersTable
          rows={d.rows.map((r) => ({ ...r, client: r.client ?? "", project: r.project ?? "", periodStart: r.periodStart.toISOString(), periodEnd: r.periodEnd.toISOString(), total: r.total != null ? Number(r.total) : null }))}
          views={d.views}
          canCreate={can(d.role, "comercial")}
        />
      </PageBody>
    </>
  );
}
